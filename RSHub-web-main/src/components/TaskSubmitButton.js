import React from 'react';
import { Menu, Button } from '@mantine/core';

export default function TaskSubmitButton({ onSelectModel }) {
  return (
    <Menu shadow="md" width={240}>
      <Menu.Target>
        <Button 
          variant="filled" 
          size="md"
          style={{
            background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
          }}
        >
          Submit Task
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Select Scenario & Model</Menu.Label>
        <Menu.Divider />
        
        <Menu.Label>Soil Models</Menu.Label>
        <Menu.Item onClick={() => onSelectModel('soil')}>
          Soil (NMM3D Full Wave)
        </Menu.Item>
        
        <Menu.Divider />
        
        <Menu.Label>Snow Models</Menu.Label>
        <Menu.Item onClick={() => onSelectModel('snow-tri')}>
          Snow (DMRT-TRI)
        </Menu.Item>
        <Menu.Item onClick={() => onSelectModel('snow-bic')}>
          Snow (DMRT-BIC)
        </Menu.Item>
        <Menu.Item onClick={() => onSelectModel('snow-qms')}>
          Snow (DMRT-QMS)
        </Menu.Item>
        
        <Menu.Divider />
        <Menu.Label>Vegetation Models</Menu.Label>
        <Menu.Item onClick={() => onSelectModel('vegetation')}>
          Vegetation (VPRT)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

