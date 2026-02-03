#!/usr/bin/env python3
import os
import json
import sys
import argparse
import random
from pathlib import Path

# Add the parent directory to sys.path to import app modules
sys.path.append(str(Path(__file__).parent.parent.parent))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.system_instruction import SystemInstruction


def get_all_system_instructions(db: Session):
    """Get all system instructions with their examples and training data"""
    return db.query(SystemInstruction).all()


def create_jsonl_for_instruction(instruction):
    """Create JSONL data for a single system instruction"""
    jsonl_data = []

    # Get the system instruction content
    system_content = (
        instruction.instruction_text
        if not instruction.use_prompt_id
        else f"Using prompt ID: {instruction.prompt_id}"
    )

    # Process examples
    for example in instruction.examples:
        chat_completion = {
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": example.user_message},
                {"role": "assistant", "content": example.assistant_message},
            ]
        }
        jsonl_data.append(chat_completion)

    # Process training data
    for td in instruction.training_data:
        chat_completion = {
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": td.user_message},
                {"role": "assistant", "content": td.assistant_message},
            ]
        }
        jsonl_data.append(chat_completion)

    return jsonl_data


def split_data(data, train_ratio=0.9):
    """Split data into training and validation sets"""
    # Shuffle the data to ensure random distribution
    shuffled_data = data.copy()
    random.shuffle(shuffled_data)

    # Calculate split point
    split_idx = int(len(shuffled_data) * train_ratio)

    # Split the data
    train_data = shuffled_data[:split_idx]
    val_data = shuffled_data[split_idx:]

    return train_data, val_data


def save_jsonl(data, filename):
    """Save data as JSONL file"""
    with open(filename, "w", encoding="utf-8") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


def validate_jsonl(filename):
    """Validate a JSONL file for fine-tuning format"""
    print(f"Validating {filename}...")
    line_count = 0
    errors = []

    with open(filename, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line_count += 1
            try:
                data = json.loads(line)
                # Check for required fields
                if "messages" not in data:
                    errors.append(f"Line {i}: Missing 'messages' field")
                    continue

                messages = data["messages"]
                if not isinstance(messages, list) or len(messages) < 2:
                    errors.append(
                        f"Line {i}: 'messages' must be a list with at least 2 items"
                    )
                    continue

                # Check for required roles
                roles = [msg.get("role") for msg in messages]
                if "system" not in roles:
                    errors.append(f"Line {i}: Missing 'system' role")
                if "user" not in roles:
                    errors.append(f"Line {i}: Missing 'user' role")
                if "assistant" not in roles:
                    errors.append(f"Line {i}: Missing 'assistant' role")

                # Check for content in each message
                for j, msg in enumerate(messages):
                    if "content" not in msg or not msg["content"]:
                        errors.append(
                            f"Line {i}, message {j+1}: Missing or empty 'content'"
                        )

            except json.JSONDecodeError:
                errors.append(f"Line {i}: Invalid JSON")

    if errors:
        print(f"Found {len(errors)} errors in {filename}:")
        for error in errors:
            print(f"  - {error}")
        return False
    else:
        print(f"✓ {filename} is valid ({line_count} examples)")
        return True


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Generate JSONL files for fine-tuning from system instructions"
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default="finetuning_data",
        help="Output directory for JSONL files (default: finetuning_data)",
    )
    parser.add_argument(
        "-n",
        "--name",
        type=str,
        help="Filter system instructions by name (case-insensitive substring match)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate the generated JSONL files",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for data splitting (default: 42)",
    )
    return parser.parse_args()


def main():
    """Generate JSONL files for fine-tuning from system instructions"""
    # Parse command line arguments
    args = parse_args()

    # Set random seed for reproducibility
    random.seed(args.seed)

    # Create output directory if it doesn't exist
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)

    # Get database session
    db = SessionLocal()
    try:
        # Get all system instructions
        instructions = get_all_system_instructions(db)

        # Filter by name if specified
        if args.name:
            name_filter = args.name.lower()
            instructions = [
                inst for inst in instructions if name_filter in inst.name.lower()
            ]

        print(f"Found {len(instructions)} system instructions")

        # For creating combined files with all examples
        all_examples = []
        total_examples = 0

        for instruction in instructions:
            # Skip instructions using prompt_id if they don't have instruction_text
            if instruction.use_prompt_id and not instruction.instruction_text:
                print(
                    f"Skipping '{instruction.name}' as it uses prompt_id without instruction_text"
                )
                continue

            # Create JSONL data
            jsonl_data = create_jsonl_for_instruction(instruction)

            if not jsonl_data:
                print(f"No examples or training data found for '{instruction.name}'")
                continue

            # Add to combined data
            all_examples.extend(jsonl_data)
            total_examples += len(jsonl_data)

            # Create a safe filename
            safe_name = instruction.name.replace(" ", "_").replace("/", "_").lower()

            # Split data into training and validation sets
            if len(jsonl_data) > 1:  # Only split if we have more than one example
                train_data, val_data = split_data(jsonl_data)

                # Save the training JSONL file
                train_filename = output_dir / f"{safe_name}_train.jsonl"
                save_jsonl(train_data, train_filename)
                print(
                    f"Created {train_filename} with {len(train_data)} training examples"
                )

                # Save the validation JSONL file if we have validation data
                if val_data:
                    val_filename = output_dir / f"{safe_name}_val.jsonl"
                    save_jsonl(val_data, val_filename)
                    print(
                        f"Created {val_filename} with {len(val_data)} validation examples"
                    )
            else:
                # If we only have one example, put it in the training set
                filename = output_dir / f"{safe_name}_train.jsonl"
                save_jsonl(jsonl_data, filename)
                print(
                    f"Created {filename} with {len(jsonl_data)} training examples (too few to split)"
                )

        # Save combined files if we have any examples
        if all_examples:
            # Split the combined data
            all_train_data, all_val_data = split_data(all_examples)

            # Save combined training file
            combined_train_filename = (
                output_dir / "all_instructions_combined_train.jsonl"
            )
            save_jsonl(all_train_data, combined_train_filename)
            print(
                f"Created combined training file {combined_train_filename} with {len(all_train_data)} examples"
            )

            # Save combined validation file
            combined_val_filename = output_dir / "all_instructions_combined_val.jsonl"
            save_jsonl(all_val_data, combined_val_filename)
            print(
                f"Created combined validation file {combined_val_filename} with {len(all_val_data)} examples"
            )

            # Save the full combined file for backward compatibility
            combined_filename = output_dir / "all_instructions_combined.jsonl"
            save_jsonl(all_examples, combined_filename)
            print(
                f"Created combined file {combined_filename} with {total_examples} examples"
            )

        # Validate files if requested
        if args.validate and all_examples:
            print("\nValidating generated files...")
            valid_files = 0
            total_files = 0

            # Validate individual files
            for instruction in instructions:
                if instruction.examples or instruction.training_data:
                    total_files += 2  # Train and val files
                    safe_name = (
                        instruction.name.replace(" ", "_").replace("/", "_").lower()
                    )
                    train_filename = output_dir / f"{safe_name}_train.jsonl"
                    if validate_jsonl(train_filename):
                        valid_files += 1

                    val_filename = output_dir / f"{safe_name}_val.jsonl"
                    if Path(val_filename).exists():  # Only validate if the file exists
                        if validate_jsonl(val_filename):
                            valid_files += 1
                    else:
                        total_files -= 1  # Adjust count if no val file

            # Validate combined files
            total_files += 3  # Combined, train, and val files
            if validate_jsonl(combined_filename):
                valid_files += 1
            if validate_jsonl(combined_train_filename):
                valid_files += 1
            if validate_jsonl(combined_val_filename):
                valid_files += 1

            print(f"\nValidation summary: {valid_files}/{total_files} files are valid")

    finally:
        db.close()


if __name__ == "__main__":
    main()
