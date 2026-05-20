import io
import csv
import logging
from typing import Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


def dict_to_csv(data_dict: Dict[str, Any]) -> str:
    """
    Convert RSHub result dictionary to CSV format
    
    Args:
        data_dict: Result dictionary from load_outputs()
        
    Returns:
        CSV formatted string
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['Variable', 'Value'])
    
    for key, value in data_dict.items():
        if isinstance(value, (np.ndarray, list)):
            if isinstance(value, np.ndarray):
                value = value.tolist()
            
            if isinstance(value, list) and len(value) > 0:
                if isinstance(value[0], (list, np.ndarray)):
                    flattened = str(value)
                    writer.writerow([key, flattened])
                else:
                    value_str = ', '.join(map(str, value))
                    writer.writerow([key, value_str])
            else:
                writer.writerow([key, str(value)])
        else:
            writer.writerow([key, str(value)])
    
    csv_content = output.getvalue()
    output.close()
    
    return csv_content


def dict_to_text(data_dict: Dict[str, Any]) -> str:
    """
    Convert RSHub result dictionary to readable text format
    
    Args:
        data_dict: Result dictionary from load_outputs()
        
    Returns:
        Text formatted string
    """
    lines = ["RSHub Task Result", "=" * 50, ""]
    
    for key, value in data_dict.items():
        if isinstance(value, (np.ndarray, list)):
            if isinstance(value, np.ndarray):
                value = value.tolist()
            
            lines.append(f"{key}:")
            if isinstance(value, list) and len(value) > 0:
                if isinstance(value[0], (list, np.ndarray)):
                    lines.append(f"  Shape: {np.array(value).shape if isinstance(value, list) else value.shape}")
                    lines.append(f"  Data: {value}")
                else:
                    lines.append(f"  Values: {value}")
            else:
                lines.append(f"  {value}")
        else:
            lines.append(f"{key}: {value}")
        lines.append("")
    
    return "\n".join(lines)


