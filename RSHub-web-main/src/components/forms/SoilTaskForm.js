import React, { useState } from 'react';
import { Modal, TextInput, NumberInput, Select, Button, Stack, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { taskAPI } from '../../utils/apiClient';
import { useUserAuth } from '../UserAuthContext';
import useTaskStore from '../../stores/taskStore';
import { getAuthToken } from '../../utils/auth';

export default function SoilTaskForm({ opened, onClose }) {
  const { token: contextToken } = useUserAuth();
  const addTask = useTaskStore((state) => state.addTask);
  const triggerRefresh = useTaskStore((state) => state.triggerRefresh);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      projectName: '',
      taskName: '',
      output_var: 'tb',
      fGHz: '',
      angle: '',
      soilType:'2',
      rmsh: '',
      cLx: '',
      cLy: '',
      layerZaxis:'',
      epsr_re: '',
      epsr_im: '',
      Tg: '',
      Lx: '',
      Ly: '',
      Lz: '',
      xr: '',
      yr: '',
      zr: '',
      delta_d: '',
      epsr_sub_re: '',
      epsr_sub_im: '',
      Tsub: '',
    },
    validate: {
      projectName: (value) => (value ? null : 'Project name is required'),
      taskName: (value) => (value ? null : 'Task name is required'),
      output_var: (value) => (value ? null : 'Output type is required'),
      fGHz: (value) => (value ? null : 'Frequency is required'),
      angle: (value) => (value ? null : 'Incident angle is required'),
    },
  });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    
    try {
      const task_data = {
        scenario_flag: 'soil',
        algorithm: 'vie',
        output_var: values.output_var === 'sigma' ? 'sigma' : 'tb',
        fGHz: parseFloat(values.fGHz),
        angle: parseFloat(values.angle),
      };

      const optionalFields = [
        'nr', 'ir_beg', 'ir_end', 'tol', 'rest', 'maxiter', 'N', 'seed'
      ];

      optionalFields.forEach(field => {
        if (values[field] !== '' && values[field] !== null && values[field] !== undefined) {
          task_data[field] = parseFloat(values[field]);
        }
      });

      const token = getAuthToken();
      if (!token) {
        notifications.show({
          title: 'Error',
          message: 'Please login again',
          color: 'red',
        });
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        return;
      }

      const requestData = {
        token: token,
        project_name: values.projectName,
        task_name: values.taskName,
        task_data: task_data,
      };

      const result = await taskAPI.submitTask(requestData);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: `Task ${values.taskName} submitted successfully`,
          color: 'green',
        });
        
        addTask({
          projectName: values.projectName,
          taskName: values.taskName,
          status: 'queued',
          startDate: new Date().toISOString()
        });
        
        triggerRefresh();
        form.reset();
        onClose();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error?.message || 'Failed to submit task',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to submit task',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="lg" fw={700}>Submit Soil Task (NMM3D Full Wave)</Text>}
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Required fields are marked with <Text component="span" c="red">*</Text>
          </Text>

          <TextInput
            label="Project Name"
            placeholder="e.g., soil_modeling_2024"
            required
            withAsterisk
            {...form.getInputProps('projectName')}
          />

          <TextInput
            label="Task Name"
            placeholder="e.g., aiem_test_01"
            required
            withAsterisk
            {...form.getInputProps('taskName')}
          />

          <Select
            label="Output Type (Both Tb and Sigma are simulated. Select which simulated result to retrieve)"
            required
            withAsterisk
            data={[
              { value: 'sigma', label: 'Active (Backscatter)' },
              { value: 'tb', label: 'Passive (Brightness Temperature)' },
            ]}
            {...form.getInputProps('output_var')}
          />

          <NumberInput
            label="Frequency"
            placeholder="Default: 1.26"
            required
            withAsterisk
            min={0}
            step={0.001}
            decimalScale={3}
            suffix=" GHz"
            {...form.getInputProps('fGHz')}
          />

          <NumberInput
            label="Incident Angle"
            placeholder="Default: 40"
            required
            withAsterisk
            min={0}
            max={90}
            step={1}
            suffix=" degrees"
            {...form.getInputProps('angle')}
          />

          <Text size="sm" fw={600} mt="md">Layered Soil Parameters</Text>

          <Group grow>
            <Select
              label="Rough Type"
              description="Autocorrelation function"
              data={[
                { value: '1', label: 'Gaussian' },
                { value: '2', label: 'Exponential' },
              ]}
              placeholder="Default: 2 (Exponential)"
              {...form.getInputProps('soilType')}
            />
            <NumberInput
              label="RMS Height (h)"
              placeholder="Default: 0.01"
              min={0}
              step={0.001}
              decimalScale={3}
              suffix=" m"
              {...form.getInputProps('rmsh')}
            />
            
          </Group>

          <Group grow>
            <NumberInput
              label="Correlation Length X (cLx)"
              placeholder="Default: 0.1"
              min={0}
              step={0.01}
              decimalScale={2}
              suffix=" m"
              {...form.getInputProps('cLx')}
            />

            <NumberInput
              label="Correlation Length Y (cLy)"
              placeholder="Default: 0.1"
              min={0}
              step={0.01}
              decimalScale={2}
              suffix=" m"
              {...form.getInputProps('cLy')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="# total soil layer height (from bottom)"
              placeholder="Default: 0.1 (m)"
              suffix=" m"
              {...form.getInputProps('layerZaxis')}
            />

            <NumberInput
              label="Soil Temperature"
              placeholder="Default: 273.15 (K)"
              {...form.getInputProps('Tg')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Real Number of Permittivity"
              placeholder="Default: 5.2"
              step={0.1}
              decimalScale={2}
              {...form.getInputProps('epsr_re')}
            />
            <NumberInput
              label="Imaginary Number of Permittivity"
              placeholder="Default: 0.46"
              step={0.01}
              decimalScale={3}
              {...form.getInputProps('epsr_im')}
            />
          </Group>

          <Text size="sm" fw={600} mt="md">Substrate Soil Parameters </Text>
          <Text size="sm" fw={500} mt="md">Below layered soil (assuming infinite height)</Text>
          
          <NumberInput
              label="Substrate Soil Temperature"
              placeholder="Default: 295.15 (K)"
              {...form.getInputProps('Tsub')}
          />

          <Group grow>
            <NumberInput
              label="Real number of Permittivity"
              placeholder="Default: 5.2"
              step={0.1}
              decimalScale={2}
              {...form.getInputProps('epsr_sub_re')}
            />
            <NumberInput
              label="Imaginary number of Permittivity"
              placeholder="Default: 0.46"
              step={0.01}
              decimalScale={3}
              {...form.getInputProps('epsr_sub_im')}
            />
          </Group>
          
          <Text size="sm" fw={600} mt="md">Simulation Parameter Settings</Text>

          <Group grow>
            <NumberInput
              label="Soil Cube Length X (Lx)"
              placeholder="Default: 1.6"
              min={0}
              step={0.1}
              decimalScale={2}
              suffix=" m"
              {...form.getInputProps('Lx')}
            />
            <NumberInput
              label="Soil Cube Length Y (Ly)"
              placeholder="Default: 1.6"
              min={0}
              step={0.1}
              decimalScale={2}
              suffix=" m"
              {...form.getInputProps('Ly')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Soil Cube Length Z (Lz)"
              placeholder="Default: 0.05"
              min={0}
              step={0.01}
              decimalScale={3}
              suffix=" m"
              {...form.getInputProps('Lz')}
            />
            <NumberInput
              label="Discretization length"
              placeholder="Default: 0.01"
              min={0}
              step={0.002}
              decimalScale={3}
              suffix=" m"
              {...form.getInputProps('delta_d')}
            />
          </Group>

          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              loading={submitting}
              style={{
                background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
              }}
            >
              Submit Task
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

