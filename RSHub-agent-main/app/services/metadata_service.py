import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class MetadataService:
    """Service for extracting metadata from task parameters"""
    
    @staticmethod
    def extract_metadata_from_task_data(task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract download metadata from task submission data
        
        Args:
            task_data: Task configuration data
        
        Returns:
            Dictionary containing metadata needed for download
        """
        metadata = {}
        
        # Extract fGHz
        fGHz_raw = task_data.get('fGHz')
        if isinstance(fGHz_raw, list):
            metadata['fGHz'] = fGHz_raw[0] if fGHz_raw else 1.41
        else:
            metadata['fGHz'] = fGHz_raw if fGHz_raw is not None else 1.41
        
        # Extract scenario_flag
        scenario = task_data.get('scenario_flag')
        if isinstance(scenario, int):
            scenario_map = {1: 'soil', 2: 'snow', 3: 'veg'}
            metadata['scenario'] = scenario_map.get(scenario, 'soil')
        else:
            metadata['scenario'] = scenario if scenario else 'soil'
        
        # Extract output_var
        output_var = task_data.get('output_var')
        if isinstance(output_var, int):
            output_map = {1: 'bs', 2: 'tb'}
            metadata['output_var'] = output_map.get(output_var, 'bs')
        else:
            metadata['output_var'] = output_var if output_var else 'bs'
        
        # Extract angle (optional, scenario-specific)
        angle_raw = task_data.get('angle') or task_data.get('theta_i_deg')
        if angle_raw is not None:
            if isinstance(angle_raw, list):
                metadata['angle'] = angle_raw[0] if angle_raw else None
            else:
                metadata['angle'] = angle_raw
        else:
            metadata['angle'] = None
        
        # Extract algorithm (required for rshub v0.3.3+)
        algorithm = task_data.get('algorithm')
        if algorithm:
            metadata['algorithm'] = algorithm
        else:
            # Fallback based on scenario if algorithm not provided
            scenario_defaults = {
                'soil': 'fullwave_volume',
                'snow': 'qms',
                'veg': 'rt'
            }
            metadata['algorithm'] = scenario_defaults.get(metadata.get('scenario', 'soil'), 'qms')
        
        return metadata
