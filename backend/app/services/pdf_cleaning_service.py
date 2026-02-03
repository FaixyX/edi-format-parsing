#!/usr/bin/env python3
"""
PDF Widget Cleaning Service

This service implements the "Reprint Values" approach to clean up PDF form widgets:
- Remove widget UI elements (arrows, borders) that interfere with OCR
- Reprint field values as clean text
- Handle both form-based and scanned PDFs gracefully

Based on the widget_cleaner_gui.py implementation with exact same logic.
"""

import os
import io
import sys
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any

# Third-party
try:
    import fitz  # PyMuPDF
except Exception as e:
    logging.error("PyMuPDF (pymupdf) is required. Install with: pip install pymupdf")
    raise

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception as e:
    logging.error("Pillow is required. Install with: pip install pillow")
    raise

logger = logging.getLogger(__name__)


@dataclass
class ProcessingParams:
    """Parameters for PDF processing."""

    font_size_ratio: float = 0.70
    include_choice_widgets: bool = True
    include_text_widgets: bool = False
    all_choice_widgets: bool = True  # Process all combo boxes, not just numeric ones
    text_color: Tuple[int, int, int] = (0, 0, 0)  # Black


def get_choice_value(widget) -> str:
    """Extract the current value from a form widget."""
    val = getattr(widget, "field_value", None)
    field_name = getattr(widget, "field_name", "unknown")

    # Special handling for widgets with mixed content (field name + value with newlines)
    if field_name in ["GG0170_Q", "GG0170_RR1", "GG0170_SS1"]:
        # For these widgets, the get_textbox result contains both field name and value with newlines
        # We need to extract just the numeric value
        try:
            page = getattr(widget, "parent", None)
            rect = getattr(widget, "rect", None)

            if page and rect:
                displayed_text = page.get_textbox(rect)
                if displayed_text and displayed_text.strip():
                    # Split by newlines and get all non-empty lines
                    lines = [
                        line.strip()
                        for line in displayed_text.split("\n")
                        if line.strip()
                    ]

                    # Look for the actual value (should be "0" for this widget)
                    for line in lines:
                        if line.isdigit() or line in [
                            "0",
                            "1",
                            "2",
                            "-",
                        ]:
                            return line

                return ""
        except Exception:
            pass

    # For choice widgets, try to get the actual displayed text from the widget area
    if is_choice_widget(widget):
        try:
            # Get the widget's page and rectangle
            page = getattr(widget, "parent", None)
            rect = getattr(widget, "rect", None)

            if page and rect:
                # Extract the actual text displayed in the widget area
                displayed_text = page.get_textbox(rect)
                if displayed_text and displayed_text.strip():
                    return displayed_text.strip()
        except Exception:
            # If text extraction fails, fall back to the original method
            pass

        # Fallback: Try to get the choice_values (list of tuples: (value, display_text))
        choice_values = getattr(widget, "choice_values", None)

        if choice_values and val is not None:
            val_str = str(val)
            # Look for the tuple where the first element matches our field value
            for choice_tuple in choice_values:
                if len(choice_tuple) >= 2 and str(choice_tuple[0]) == val_str:
                    # Return the display text (second element)
                    return str(choice_tuple[1])

            # If no match found in choice_values, try the old method as fallback
            choices = None
            for attr_name in ["field_choices", "choices", "field_options", "options"]:
                choices = getattr(widget, attr_name, None)
                if choices:
                    break

            if choices:
                # If val is a number (index), try to map it to the choice text
                try:
                    val_int = int(val)
                    if 0 <= val_int < len(choices):
                        return str(choices[val_int])
                except (ValueError, TypeError):
                    pass

                # Try string matching
                if val_str in choices:
                    return val_str

    # Normalize list-like to string if needed
    if isinstance(val, (list, tuple)):
        val = ", ".join([str(v) for v in val])
    return str(val) if val is not None else ""


def is_choice_widget(widget) -> bool:
    """Check if widget is a choice/combo box widget."""
    ftype_str = (getattr(widget, "field_type_string", "") or "").lower()
    if ftype_str in {"choice", "combobox", "combo", "listbox"}:
        return True
    try:
        return getattr(widget, "field_type", None) == fitz.PDF_WIDGET_TYPE_CHOICE
    except Exception:
        return False


def is_text_widget(widget) -> bool:
    """Check if widget is a text input widget."""
    ftype_str = (getattr(widget, "field_type_string", "") or "").lower()
    if ftype_str in {"text", "textfield", "input"}:
        return True
    try:
        return getattr(widget, "field_type", None) == fitz.PDF_WIDGET_TYPE_TEXT
    except Exception:
        return False


def has_numeric_options(widget) -> bool:
    """Check if a combo box widget has at least one numeric option."""
    if not is_choice_widget(widget):
        return False

    try:
        # Try to get the choice_values (list of tuples: (value, display_text))
        choice_values = getattr(widget, "choice_values", None)

        if choice_values:
            # Check if any display text is numeric
            for choice_tuple in choice_values:
                if len(choice_tuple) >= 2:
                    display_text = str(choice_tuple[1]).strip()
                    # Check if the display text is a number (integer or float)
                    try:
                        float(display_text)
                        return True
                    except ValueError:
                        # Check if it contains numbers (partial numeric)
                        if any(char.isdigit() for char in display_text):
                            return True
            return False

        # Fallback: try other choice attributes
        choices = None
        for attr_name in ["field_choices", "choices", "field_options", "options"]:
            choices = getattr(widget, attr_name, None)
            if choices:
                break

        if not choices:
            # If no choices found, check if the current value is numeric
            value = get_choice_value(widget)
            if value.strip():
                try:
                    float(value.strip())
                    return True
                except ValueError:
                    # Check if it contains numbers (partial numeric)
                    if any(char.isdigit() for char in value):
                        return True
            return False

        # Check if any choice is numeric
        for choice in choices:
            choice_str = str(choice).strip()
            # Check if the choice is a number (integer or float)
            try:
                float(choice_str)
                return True
            except ValueError:
                # Check if it contains numbers (partial numeric)
                if any(char.isdigit() for char in choice_str):
                    return True
        return False
    except Exception as e:
        logger.error(f"Error in has_numeric_options: {e}")
        return False


def draw_text_on_pdf_page(page, widget, value: str, params: ProcessingParams):
    """Draw text directly onto a PDF page at the widget location."""
    # Get widget rectangle in PDF coordinates (points)
    r = widget.rect

    # Calculate font size based on widget height
    widget_height = r.y1 - r.y0
    font_size = max(8, int(params.font_size_ratio * widget_height))

    # Try to load a system font
    font_name = "helv"  # Default PDF font
    try:
        # Try to use a system font if available
        font_paths = [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Arial.ttf",
        ]

        for font_path in font_paths:
            if Path(font_path).exists():
                # Add font to PDF document
                font_name = page.insert_font(fontfile=font_path)
                break
    except Exception:
        # Fallback to default font
        pass

    # Calculate text position (left-aligned with padding, adjusted for better positioning)
    padding_x = 0.12 * (r.x1 - r.x0)  # Increased from 0.06 to 0.12 (move right)
    text_x = r.x0 + padding_x
    text_y = r.y0 + (widget_height * 0.8)  # Increased from 0.3 to 0.4 (move lower)

    # Draw the text
    try:
        page.insert_text(
            (text_x, text_y),
            value,
            fontsize=font_size,
            fontname=font_name,
            color=params.text_color,
        )
    except Exception:
        # Fallback: try with default font
        try:
            page.insert_text(
                (text_x, text_y),
                value,
                fontsize=font_size,
                color=params.text_color,
            )
        except Exception as e:
            logger.warning(f"Could not draw text '{value}': {e}")


def process_pdf_direct(
    input_pdf: str,
    output_pdf: str,
    params: ProcessingParams,
    assessment_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Process PDF directly by removing widgets and drawing values back."""
    doc = fitz.open(str(input_pdf))

    results = {
        "total_pages": doc.page_count,
        "processed_pages": 0,
        "widgets_found": 0,
        "choice_widgets": 0,
        "text_widgets": 0,
        "widgets_removed": 0,
    }

    for i in range(doc.page_count):
        page = doc.load_page(i)

        # Skip pages based on assessment type
        if assessment_type:
            assessment_type_lower = assessment_type.lower()
            page_num = i + 1  # Convert to 1-indexed for logging
        # Get widgets for this page
        widgets = list(page.widgets()) if page.widgets() else []
        page_widgets = 0
        widgets_to_remove = []

        for w in widgets:
            # Check if we should process this widget type
            is_choice = is_choice_widget(w)
            is_text = is_text_widget(w)

            # For choice widgets, check if we should process them
            if is_choice and params.include_choice_widgets:
                if params.all_choice_widgets:
                    # Process all choice widgets regardless of numeric options
                    pass
                else:
                    # Only process if they have numeric options
                    has_numeric = has_numeric_options(w)
                    if not has_numeric:
                        continue
            elif is_text and params.include_text_widgets:
                # Text widgets are processed normally (no numeric requirement)
                pass
            else:
                continue

            # Get the field value
            value = get_choice_value(w)

            if value is not None and value != "":  # Only process if there's a value
                # Draw text directly onto the PDF page
                draw_text_on_pdf_page(page, w, value, params)

                # Mark widget for removal
                widgets_to_remove.append(w)

                page_widgets += 1
                results["widgets_found"] += 1

                if is_choice:
                    results["choice_widgets"] += 1
                if is_text:
                    results["text_widgets"] += 1

        # Remove the processed widgets from the page
        for widget in widgets_to_remove:
            page.delete_widget(widget)
            results["widgets_removed"] += 1

        results["processed_pages"] += 1

    # Save the modified PDF
    doc.save(output_pdf)
    doc.close()
    return results


def clean_pdf_for_ocr(
    pdf_file_path: str, assessment_type: Optional[str] = None
) -> Optional[str]:
    """
    Clean a PDF file for better OCR processing by removing widget UI elements
    and reprinting field values as clean text.

    Args:
        pdf_file_path: Path to the input PDF file
        assessment_type: Type of assessment (e.g., "soc", "roc", "recert_followup", "other_followup")

    Returns:
        Path to the cleaned PDF file, or None if cleaning failed or not needed
    """
    try:
        logger.info(f"Starting PDF cleaning for: {pdf_file_path}")

        # Check if the PDF has form widgets
        doc = fitz.open(pdf_file_path)
        has_widgets = False

        for i in range(doc.page_count):
            page = doc.load_page(i)
            widgets = list(page.widgets()) if page.widgets() else []
            if widgets:
                has_widgets = True
                break

        doc.close()

        if not has_widgets:
            logger.info("PDF has no form widgets, skipping cleaning")
            return None

        # Create output file path
        input_path = Path(pdf_file_path)
        output_path = (
            input_path.parent / f"{input_path.stem}_cleaned{input_path.suffix}"
        )

        # Configure processing parameters
        params = ProcessingParams(
            font_size_ratio=0.70,
            include_choice_widgets=True,
            include_text_widgets=False,
            all_choice_widgets=True,  # Process all combo boxes
            text_color=(0, 0, 0),
        )

        # Process the PDF
        results = process_pdf_direct(
            str(input_path), str(output_path), params, assessment_type
        )

        logger.info(
            f"PDF cleaning completed: {results['widgets_removed']} widgets removed from {results['processed_pages']} pages"
        )

        return str(output_path)

    except Exception as e:
        logger.warning(f"PDF cleaning failed for {pdf_file_path}: {str(e)}")
        logger.warning(
            "Continuing with original PDF (may be scanned or have other issues)"
        )
        return None
