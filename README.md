# EDI Extraction Application

This application extracts and parses data from EDI (Electronic Data Interchange) files, specifically 277 response files, and converts them into JSON format.

## Prerequisites

- Python 3.x installed on your system

## Setup Instructions

### 1. Create Virtual Environment

Create a virtual environment to isolate project dependencies:

```bash
python -m venv venv
```

### 2. Activate Virtual Environment

**On macOS/Linux:**
```bash
source venv/bin/activate
```

**On Windows:**
```bash
venv\Scripts\activate
```

### 3. Install Dependencies

Install the required packages from `requirements.txt`:

```bash
pip install -r requirements.txt
```

## Usage

### 1. Edit Input File Name

Open `extraction.py` and edit line 58 to specify your EDI file name:

```python
INPUT_EDI = "your-file-name.edi"
```

Replace `"your-file-name.edi"` with the actual name of your EDI file.

### 2. Run the Application

Execute the script:

```bash
python extraction.py
```

The application will:
- Fix and preprocess the EDI file
- Parse the EDI data
- Generate an `output.json` file with the extracted information

## Output

The application generates `output.json` containing:
- Header date
- Provider NPI
- Patient information including:
  - Name
  - Member ID
  - Trace number
  - Service dates
  - Amount
  - Status
  - Claim ID
  - Type of Bill (TOB)

## Notes

- The application creates a temporary `fixed.edi` file during processing
- Make sure your EDI file is in the same directory as `extraction.py`
- The output JSON file will be created in the same directory
