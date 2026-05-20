import React, { useState } from 'react';
import { Modal, TextInput, NumberInput, Select, Button, Stack, Group, Text, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { taskAPI } from '../../utils/apiClient';
import { useUserAuth } from '../UserAuthContext';
import useTaskStore from '../../stores/taskStore';
import { getAuthToken } from '../../utils/auth';

export default function SnowTaskForm({ opened, onClose, algorithm }) {
  const { token: contextToken } = useUserAuth();
  const addTask = useTaskStore((state) => state.addTask);
  const triggerRefresh = useTaskStore((state) => state.triggerRefresh);
  const [submitting, setSubmitting] = useState(false);

  const isBIC = algorithm === 'snow-bic';
  const isQMS = algorithm === 'snow-qms';
  const isTRI = algorithm === 'snow-tri';

  const form = useForm({
    initialValues: {
      projectName: '',
      taskName: '',
      output_var: 'tb',
      fGHz: '',
      angle: '',
      depth: '',
      rho: '',
      kc: (isBIC || isTRI) ? '' : undefined,
      zp: (isBIC || isTRI) ? '' : undefined,
      wet: isTRI ? '' : undefined,
      film: isTRI ? '' : undefined,
      dia: isQMS ? '' : undefined,
      tau: isQMS ? '' : undefined,
      surf_model_setting:['QH',0,isTRI ? 0 : 0],
      Tsnow: '',
      Tg: '',
      mv: '',
      clayfrac: '',
      // lut_flag: isBIC ? '1' : undefined,
      // Nquad: '',
    },
    validate: {
      projectName: (value) => (value ? null : 'Project name is required'),
      taskName: (value) => (value ? null : 'Task name is required'),
      output_var: (value) => (value ? null : 'Output type is required'),
      fGHz: (value) => (value ? null : 'Frequency is required'),
      angle: (value) => (value ? null : 'Incident angle is required'),
    },
  });

  const selectedSurfModel = form?.values?.surf_model_setting?.[0] || 'QH';
  const surfSetting1Label = selectedSurfModel === 'OH'
    ? 'Rough ground rms height (cm)'
    : 'Polarization mixing factor (unitless)';
  const surfSetting2Label = selectedSurfModel === 'OH'
    ? 'Ratio: correlation length / rms height'
    : 'Roughness height factor (unitless)';
  const surfSetting1Description = selectedSurfModel === 'OH'
    ? 'rms = 0 assumes flat bottom boundary'
    : 'Q = H = 0 means flat bottom surface';
  const surfSetting2Description = selectedSurfModel === 'OH'
    ? 'Unitless ratio of correlation length to rms height'
    : 'Q = H = 0 means flat bottom surface';

  const parseArrayInput = (input) => {
    if (!input || input.trim() === '') return null;
    try {
      const values = input.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      return values.length > 0 ? values : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    
    try {
      const task_data = {
        scenario_flag: 'snow',
        algorithm: isBIC ? 'bic' : isTRI ? 'tri' : 'qms',
        output_var: values.output_var === 'sigma' ? 'sigma' : 'tb',
        surf_model_setting: [
          values?.surf_model_setting?.[0] || 'QH',
          parseFloat(values?.surf_model_setting?.[1]) || 0,
          parseFloat(values?.surf_model_setting?.[2]) || 0,
        ],
        fGHz: parseArrayInput(values.fGHz) || [parseFloat(values.fGHz)],
        angle: parseArrayInput(values.angle) || [parseFloat(values.angle)],
      };

      const arrayFields = ['depth', 'rho', 'Tsnow'];
      if (isBIC || isTRI) {
        arrayFields.push('kc', 'zp');
      }
      if (isTRI) {
        arrayFields.push('wet', 'film');
      }
      if (isQMS) {
        arrayFields.push('dia', 'tau');
      }

      arrayFields.forEach(field => {
        if (values[field]) {
          const parsed = parseArrayInput(values[field]);
          if (parsed) task_data[field] = parsed;
        }
      });

      const scalarFields = ['Tg', 'mv', 'clayfrac', 'Nquad'];
      // if (isBIC) {
      //   scalarFields.push('lut_flag');
      // }

      scalarFields.forEach(field => {
        if (values[field] !== '' && values[field] !== null && values[field] !== undefined) {
          task_data[field] = field === 'lut_flag' ? parseInt(values[field]) : parseFloat(values[field]);
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

  const algorithmLabel = isBIC ? 'BIC' : isTRI ? 'TRI' : 'QMS';
  const taskNamePlaceholder = `e.g., dmrt_${algorithmLabel.toLowerCase()}_test_01`;
  const frequencyPlaceholder = isTRI
    ? 'Default: 37 GHz'
    : 'Default: 37 GHz';
  const snowTempPlaceholder = isTRI
    ? 'Default: [273,273,273] K'
    : 'Default: [260,260,260] K';
  const soilMoisturePlaceholder = isTRI ? 'Default: 0.4' : 'Default: 0.15';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="lg" fw={700}>Submit Snow Task (DMRT-{algorithmLabel})</Text>}
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Required fields are marked with <Text component="span" c="red">*</Text>. 
            For array inputs (depth, rho, etc.), use comma-separated values: e.g., "20,20,20"
          </Text>

          <TextInput
            label="Project Name"
            placeholder="e.g., snow_modeling_2024"
            required
            withAsterisk
            {...form.getInputProps('projectName')}
          />

          <TextInput
            label="Task Name"
            placeholder={taskNamePlaceholder}
            required
            withAsterisk
            {...form.getInputProps('taskName')}
          />

          <Select
            label="Output Type"
            required
            withAsterisk
            data={[
              { value: 'sigma', label: 'Active (Backscatter)' },
              { value: 'tb', label: 'Passive (Brightness Temperature)' },
            ]}
            {...form.getInputProps('output_var')}
          />

          <TextInput
            label="Frequency"
            placeholder={frequencyPlaceholder}
            required
            withAsterisk
            {...form.getInputProps('fGHz')}
          />

          <TextInput
            label="Incident Angle"
            placeholder="Default: 40"
            required
            withAsterisk
            {...form.getInputProps('angle')}
          />

          <Text size="sm" fw={600} mt="md">Snow Parameters</Text>

          <TextInput
            label="Layered Depth"
            placeholder="Default: [20,20,20] cm"
            required
            withAsterisk
            {...form.getInputProps('depth')}
          />

          <TextInput
            label="Layered Density"
            placeholder="Default: [0.3,0.3,0.3] g/cm³"
            required
            withAsterisk
            {...form.getInputProps('rho')}
          />

          {(isBIC || isTRI) && (
            <>
              <TextInput
                label="Layered ζ parameter"
                placeholder="Default: [10000,10000,10000]"
                required
                withAsterisk
                {...form.getInputProps('kc')}
              />

              <TextInput
                label="Layered b parameter"
                placeholder="Default: [1.2,1.2,1.2]"
                required
                withAsterisk
                {...form.getInputProps('zp')}
              />

              {/* <Select
                label="Use Look-up Table (lut_flag)"
                description="1: Use LUT (fast); 0: Compute numerically (slow)"
                data={[
                  { value: '1', label: 'Yes (Use LUT - Recommended)' },
                  { value: '0', label: 'No (Compute numerically)' },
                ]}
                {...form.getInputProps('lut_flag')}
              /> */}

              {isTRI && (
                <>
                  <TextInput
                    label="Layered percent of Wetness (water content)"
                    placeholder="Default: [0,0,0] in %. 0% represents dry snow;"
                    required
                    min={0}
                    max={6}
                    step={1}
                    decimalScale={2}
                    withAsterisk
                    {...form.getInputProps('wet')}
                  />

                  <TextInput
                    label="Layered Film percentage of total water"
                    placeholder="Default: [0,0,0] in %. Choesn from 0, 50, 100"
                    required
                    min={0}
                    max={100}
                    step={50}
                    decimalScale={0}
                    withAsterisk
                    {...form.getInputProps('film')}
                  />
                </>
              )}
            </>
          )}

          {isQMS && (
            <>
              <TextInput
                label="Layered Grain Size (dia)"
                placeholder="Default: [0.15,0.15,0.15] cm. "
                required
                withAsterisk
                {...form.getInputProps('dia')}
              />

              <TextInput
                label="Layered Stickiness (tau)"
                placeholder="Default: [0.1,0.1,0.1]."
                required
                withAsterisk
                {...form.getInputProps('tau')}
              />
            </>
          )}

          <TextInput
            label="Layered Snow Temperature"
            placeholder={snowTempPlaceholder}
            required
            withAsterisk
            {...form.getInputProps('Tsnow')}
          />

          <Text size="sm" fw={600} mt="md">Soil Parameters</Text>

          <Group grow>
            <NumberInput
              label="Ground Temperature (Tg)"
              placeholder="Default: 270"
              required
              withAsterisk
              min={0}
              step={1}
              suffix=" K"
              {...form.getInputProps('Tg')}
            />
            <NumberInput
              label="Soil Moisture (mv)"
              placeholder={soilMoisturePlaceholder}
              required
              withAsterisk
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
              {...form.getInputProps('mv')}
            />
          </Group>

          <NumberInput
            label="Clay Fraction"
            placeholder="Default: 0.3"
            required
            withAsterisk
            min={0}
            max={1}
            step={0.01}
            decimalScale={2}
            {...form.getInputProps('clayfrac')}
          />

          <Select
            label="Surface Roughness Model"
            placeholder="Select roughness model"
            required
            withAsterisk
            data={[
              { value: 'QH', label: 'QH model (Passive)' },
              { value: 'OH', label: 'OH model (Active)' },
            ]}
            {...form.getInputProps('surf_model_setting.0')}
          />

          <Group grow>
            <NumberInput
              label={surfSetting1Label}
              description={surfSetting1Description}
              placeholder="0.5"
              required
              min={0}
              max={5}
              step={0.1}
              precision={1}
              {...form.getInputProps('surf_model_setting.1')}
            />
            <NumberInput
              label={surfSetting2Label}
              description={surfSetting2Description}
              placeholder="0.5"
              required
              min={0}
              max={4}
              step={0.5}
              precision={1}
              {...form.getInputProps('surf_model_setting.2')}
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

