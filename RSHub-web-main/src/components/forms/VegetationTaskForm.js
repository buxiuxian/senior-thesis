import React, { useEffect, useRef, useState } from 'react';
import { renderToString } from 'katex';
import 'katex/dist/katex.min.css';
import { Modal, TextInput, NumberInput, Select, Button, Stack, Group, Text, Paper } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { taskAPI } from '../../utils/apiClient';
import { useUserAuth } from '../UserAuthContext';
import useTaskStore from '../../stores/taskStore';
import { getAuthToken } from '../../utils/auth';

function MathDescription({ equation, className = '' }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      try {
        const html = renderToString(equation, {
          throwOnError: false,
          displayMode: false,
          errorColor: '#cc0000'
        });
        containerRef.current.innerHTML = html;
        setError(false);
      } catch (err) {
        setError(true);
        containerRef.current.textContent = equation;
      }
    }
  }, [equation]);

  return (
    <span 
      ref={containerRef} 
      className={`equation-container ${className} ${error ? 'text-red-500' : ''}`}
    />
  );
}

const parseNumber = (value, fallback = 0) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

const ProfileChart = ({ scatter, vegHeight }) => {
  const width = 300;
  const height = 150;
  const padding = 28;
  const a = parseNumber(scatter?.profile_a);
  const b = parseNumber(scatter?.profile_b);
  const c = parseNumber(scatter?.profile_c, 1);
  const zBot = parseNumber(scatter?.disbot);
  const zTopRaw = parseNumber(scatter?.distop, zBot + 1);
  const zTop = zTopRaw > zBot ? zTopRaw : zBot + 1;
  const totalHeight = Math.max(parseNumber(vegHeight, zTop), zTop, 1);
  const samples = 32;

  const points = [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const z = (i / samples) * totalHeight;
    const inWindow = z >= zBot && z <= zTop;
    const zFlip = z - totalHeight;
    const xRaw = a * zFlip * zFlip + b * zFlip + c;
    const x = inWindow ? xRaw : 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    points.push({ z, x });
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  const rangeX = maxX - minX || 1;

  const toSvg = ({ z, x }) => {
    const xPos = padding + ((x - minX) / rangeX) * (width - 2 * padding);
    const yPos = padding + ((totalHeight - z) / totalHeight) * (height - 2 * padding);
    return `${xPos},${yPos}`;
  };

  const polylinePoints = points.map(toSvg).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="#f9fafb" rx="8" />
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#d0d7de"
      />
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="#d0d7de"
      />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#ff8a65"
        strokeWidth="2"
      />
      {points.map((pt, idx) => {
        if (idx % 4 !== 0) return null;
        const [cx, cy] = toSvg(pt).split(',').map(Number);
        return <circle key={idx} cx={cx} cy={cy} r="2.5" fill="#ff8a65" />;
      })}
      <text x={width - padding} y={height - padding + 16} fontSize="10" textAnchor="end" fill="#6b7280">
        x
      </text>
      <text x={padding - 14} y={padding} fontSize="10" textAnchor="start" fill="#6b7280">
        z (m)
      </text>
    </svg>
  );
};

export default function VegetationTaskForm({ opened, onClose }) {
  const { token: contextToken } = useUserAuth();
  const addTask = useTaskStore((state) => state.addTask);
  const triggerRefresh = useTaskStore((state) => state.triggerRefresh);
  const [submitting, setSubmitting] = useState(false);

  const createDefaultScatter = () => ({
    type: '1', // 1: cylinder, 0: disc
    VM: 0.37,
    L: 7.85,
    D: 0.15,
    beta1: 0,
    beta2: 10,
    disbot: 0,
    distop: 8,
    NA: 0.24,
    profile_a: 0,
    profile_b: 0,
    profile_c: 1,
  });

  const form = useForm({
    initialValues: {
      projectName: '',
      taskName: '',
      output_var: '2',
      fGHz: '1.41',
      scatters: [createDefaultScatter()],
      sm: '0.1',
      rmsh: '0.01',
      corlength: '0.1',
      clay: '0.19',
      rough_type: '2',
      veg_height: '8',
      Tgnd: '300',
      Tveg: '300',
      force_update_flag: '1',
      perm_soil_r: '0',
      perm_soil_i: '0',
    },
    validate: {
      projectName: (value) => (value ? null : 'Project name is required'),
      taskName: (value) => (value ? null : 'Task name is required'),
      output_var: (value) => (value ? null : 'Output type is required'),
      fGHz: (value) => (value ? null : 'Frequency is required'),
      scatters: (value) => {
        if (!Array.isArray(value) || value.length === 0) return 'Add at least one scatterer';
        const requiredKeys = ['type', 'VM', 'L', 'D', 'beta1', 'beta2', 'disbot', 'distop', 'NA', 'profile_a', 'profile_b', 'profile_c'];
        const hasMissing = value.some((item) =>
          requiredKeys.some((key) => item[key] === '' || item[key] === null || item[key] === undefined || Number.isNaN(item[key]))
        );
        return hasMissing ? 'Please fill all scatterer fields' : null;
      },
      sm: (value) => (value ? null : 'Soil moisture is required'),
      rmsh: (value) => (value ? null : 'RMS Height (rmsh) is required'),
      corlength: (value) => (value ? null : 'Correlation Length is required'),
      clay: (value) => (value ? null : 'Clay Fraction is required'),
      rough_type: (value) => (value ? null : 'Roughness Type is required'),
      Tgnd: (value) => (value ? null : 'Ground Temperature is required'),
      veg_height: (value) => (value ? null : 'Vegetation Height is required'),
      Tveg: (value) => (value ? null : 'Vegetation Temperature is required'),
    },
  });

  const addScatter = () => {
    form.setFieldValue('scatters', [...form.values.scatters, createDefaultScatter()]);
  };

  const removeScatter = (index) => {
    if (form.values.scatters.length === 1) return;
    form.setFieldValue('scatters', form.values.scatters.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    
    try {
      const scatters = values.scatters.map((scatter) => ([
        Number(scatter.type),
        parseFloat(scatter.VM),
        parseFloat(scatter.L),
        parseFloat(scatter.D),
        parseFloat(scatter.beta1),
        parseFloat(scatter.beta2),
        parseFloat(scatter.disbot),
        parseFloat(scatter.distop),
        parseFloat(scatter.NA),
        parseFloat(scatter.profile_a),
        parseFloat(scatter.profile_b),
        parseFloat(scatter.profile_c),
      ]));

      const task_data = {
        scenario_flag: 'veg',
        algorithm: 'rt',
        output_var: values.output_var === '1' ? 'bs' : 'tb',
        fGHz: parseFloat(values.fGHz),
        scatters: scatters,
        force_update_flag:1,
        sm:parseFloat(values.sm),
        rmsh:parseFloat(values.rmsh),
        corlength:parseFloat(values.corlength),
        clay:parseFloat(values.clay),
        Tgnd:parseFloat(values.Tgnd),
        rough_type:values.rough_type,
        veg_height:parseFloat(values.veg_height),
        Tveg:parseFloat(values.Tveg),
        perm_soil_r:parseFloat(values.perm_soil_r),
        perm_soil_i:parseFloat(values.perm_soil_i)
      };

      // const optionalFields = [
      //   'sm', 'rmsh', 'corlength', 'clay', 'rough_type', 
      //   'veg_height', 'err', 'Tgnd', 'Tveg', 'core_num'
      // ];

      // optionalFields.forEach(field => {
      //   if (values[field] !== '' && values[field] !== null && values[field] !== undefined) {
      //     task_data[field] = parseFloat(values[field]);
      //   }
      // });

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
      title={<Text size="lg" fw={700}>Submit Vegetation Task (VPRT)</Text>}
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
            placeholder="e.g., vegetation_modeling_2024"
            required
            withAsterisk
            {...form.getInputProps('projectName')}
          />

          <TextInput
            label="Task Name"
            placeholder="e.g., vprt_forest_01"
            description='Existing tasks with same project and task Name will be overwritten'
            required
            withAsterisk
            {...form.getInputProps('taskName')}
          />

          <Select
            label="Output Type"
            required
            withAsterisk
            description="Note: Active mode is not yet supported for vegetation models"
            data={[
              { value: '2', label: 'Passive (Brightness Temperature)' },
            ]}
            {...form.getInputProps('output_var')}
          />

          <NumberInput
            label="Frequency"
            placeholder="Default: 1.41"
            required
            withAsterisk
            min={0}
            step={0.01}
            decimalScale={2}
            suffix=" GHz"
            {...form.getInputProps('fGHz')}
          />

          <Text size="sm" fw={600} mt="md">Vegetation Parameters</Text>

          <Group grow>
            <NumberInput
              label="Vegetation Height"
              placeholder="Default: 8"
              required
              withAsterisk
              min={0}
              step={0.1}
              suffix=" m"
              {...form.getInputProps('veg_height')}
            />

            <NumberInput
              label="Vegetation Temperature"
              placeholder="Default: 300"
              required
              withAsterisk
              min={0}
              step={1}
              suffix=" K"
              {...form.getInputProps('Tveg')}
            />
            {/* <NumberInput
              label="Convergence Error"
              placeholder="Default: 0.1"
              min={0}
              step={0.01}
              suffix=" K"
              {...form.getInputProps('err')}
            /> */}
          </Group>

          <Text size="sm" fw={600} mt="md">Scatterers</Text>
          <Text c="dimmed" size="sm">
            Add scatter populations. Profile parameters follow the quadratic equation:
            <br />
            <br />
            <Text span fw={500} fs="italic">x = a(z - h)² + b(z - h) + c</Text>
            <br />
            <br />
            • Set <Text span fw={600}>a = b = 0</Text> and <Text span fw={600}>c</Text> to a constant for uniform distribution along height
            <br />
            • All scatter fields are required
            <br />
            • Profile is zero outside the scatter vertical range (<Text span fw={500}>disbot</Text> to <Text span fw={500}>distop</Text>)
            <br />
            • Profile is scaled over total vegetation height
            <br />
            <br />
            <Text span fs="italic" c="blue">
              where h = vegetation height, z = current height
            </Text>
          </Text>

          <Stack gap="sm">
            {form.values.scatters.map((_, index) => (
              <Paper key={index} withBorder shadow="xs" p="md">
                <Group justify="space-between" align="center" mb="xs">
                  <Text fw={600}>Scatterer {index + 1}</Text>
                  {form.values.scatters.length > 1 && (
                    <Button size="xs" color="red" variant="light" onClick={() => removeScatter(index)}>
                      Remove
                    </Button>
                  )}
                </Group>

                <Group grow>
                  <Select
                    label="Shape"
                    description="1: cylinder; 0: disc"
                    required
                    withAsterisk
                    data={[
                      { value: '1', label: 'Cylinder' },
                      { value: '0', label: 'Disc' },
                    ]}
                    {...form.getInputProps(`scatters.${index}.type`)}
                  />
                  <NumberInput
                    label="Volumetric moisture (VM)"
                    placeholder="0.37"
                    required
                    withAsterisk
                    min={0}
                    max={1}
                    step={0.001}
                    decimalScale={3}
                    {...form.getInputProps(`scatters.${index}.VM`)}
                  />
                  <NumberInput
                    label="Length (L)"
                    placeholder="7.85"
                    required
                    withAsterisk
                    min={0}
                    step={0.0001}
                    decimalScale={4}
                    suffix=" m"
                    {...form.getInputProps(`scatters.${index}.L`)}
                  />
                  <NumberInput
                    label="Diameter (D)"
                    placeholder="0.15"
                    required
                    withAsterisk
                    min={0}
                    step={0.0001}
                    decimalScale={4}
                    suffix=" m"
                    {...form.getInputProps(`scatters.${index}.D`)}
                  />
                </Group>

                <Group grow mt="sm">
                  <NumberInput
                    label="Orientation min (beta1)"
                    description="Lower bound of orientation range"
                    required
                    withAsterisk
                    placeholder="0"
                    min={0}
                    max={180}
                    step={1}
                    suffix=" deg"
                    {...form.getInputProps(`scatters.${index}.beta1`)}
                  />
                  <NumberInput
                    label="Orientation max (beta2)"
                    description="Upper bound of orientation range"
                    required
                    withAsterisk
                    placeholder="10"
                    min={0}
                    max={180}
                    step={1}
                    suffix=" deg"
                    {...form.getInputProps(`scatters.${index}.beta2`)}
                  />
                  <NumberInput
                    label="Vertical start (disbot)"
                    description="Lower bound of vertical distribution"
                    required
                    withAsterisk
                    placeholder="0"
                    min={0}
                    step={0.1}
                    decimalScale={2}
                    suffix=" m"
                    {...form.getInputProps(`scatters.${index}.disbot`)}
                  />
                  <NumberInput
                    label="Vertical end (distop)"
                    description="Upper bound of vertical distribution"
                    required
                    withAsterisk
                    placeholder="8"
                    min={0}
                    step={0.1}
                    decimalScale={2}
                    suffix=" m"
                    {...form.getInputProps(`scatters.${index}.distop`)}
                  />
                </Group>

                <Group grow mt="sm">
                  <NumberInput
                    label="Density (NA)"
                    description="Number density of scatterer"
                    required
                    withAsterisk
                    placeholder="0.24"
                    min={0}
                    step={0.01}
                    decimalScale={2}
                    {...form.getInputProps(`scatters.${index}.NA`)}
                  />
                  <NumberInput
                    label="Profile a"
                    description={
                      <div className="flex items-center gap-2">
                        <span>a in</span>
                        <MathDescription equation="x = a(z - h)^2 + b(z - h) + c" />
                        <span>where h is vegetation height</span>
                      </div>
                    }
                    required
                    withAsterisk
                    placeholder="0"
                    step={0.01}
                    decimalScale={2}
                    {...form.getInputProps(`scatters.${index}.profile_a`)}
                  />
                  <NumberInput
                    label="Profile b"
                    description={
                      <div className="flex items-center gap-2">
                        <span>b in</span>
                        <MathDescription equation="x = a(z - h)^2 + b(z - h) + c" />
                        <span>where h is vegetation height</span>
                      </div>
                    }
                    required
                    withAsterisk
                    placeholder="0"
                    step={0.01}
                    decimalScale={2}
                    {...form.getInputProps(`scatters.${index}.profile_b`)}
                  />
                  <NumberInput
                    label="Profile c"
                    description={
                      <div className="flex items-center gap-2">
                        <span>c in</span>
                        <MathDescription equation="x = a(z - h)^2 + b(z - h) + c" />
                        <span>where h is vegetation height</span>
                      </div>
                    }
                    required
                    withAsterisk
                    placeholder="1"
                    step={0.01}
                    decimalScale={2}
                    {...form.getInputProps(`scatters.${index}.profile_c`)}
                  />
                </Group>

                <Stack gap={4} mt="sm">
                  <Text size="sm" fw={500}>Profile preview</Text>
                  <Text size="xs" c="dimmed">
                      <MathDescription equation="x = a(z - h)^2 + b(z - h) + c" />
                      <span>where h is vegetation height</span>
                  </Text>
                  <ProfileChart scatter={form.values.scatters[index]} vegHeight={form.values.veg_height} />
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Button variant="light" onClick={addScatter}>
            Add scatterer
          </Button>        

          {/* <Group grow>
            
            <NumberInput
              label="Convergence Error"
              placeholder="Default: 0.1"
              min={0}
              step={0.01}
              suffix=" K"
              {...form.getInputProps('err')}
            />
          </Group> */}

          <Text size="sm" fw={600} mt="md">Soil Parameters</Text>

          <Group grow>
            <NumberInput
              label="Soil Moisture (sm)"
              placeholder="Default: 0.1"
              required
              withAsterisk
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
              {...form.getInputProps('sm')}
            />
            <NumberInput
              label="Clay Fraction"
              placeholder="Default: 0.19"
              required
              withAsterisk
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
              {...form.getInputProps('clay')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="RMS Height (rmsh)"
              placeholder="Default: 0.01"
              required
              withAsterisk
              min={0}
              step={0.001}
              decimalScale={3}
              suffix=" m"
              {...form.getInputProps('rmsh')}
            />
            <NumberInput
              label="Correlation Length"
              placeholder="Default: 0.1"
              required
              withAsterisk
              min={0}
              step={0.01}
              decimalScale={2}
              {...form.getInputProps('corlength')}
            />
          </Group>

          <NumberInput
              label="Ground Temperature"
              placeholder="Default: 300"
              required
              withAsterisk
              min={0}
              step={1}
              suffix=" K"
              {...form.getInputProps('Tgnd')}
          />

          <Select
            label="Rough Type"
            description="Autocorrelation function"
            required
            withAsterisk
            data={[
              { value: '1', label: 'Gaussian' },
              { value: '2', label: 'Exponential' },
            ]}
            placeholder="Default: 2 (Exponential)"
            {...form.getInputProps('rough_type')}
          />

          <Group grow>
            <NumberInput
              label="Permittivity (Real part)"
              description="Model will calculate soil permittivity based on sm, clay, fGHz, if setting both real and imaginary number to 0."
              placeholder="Default: 0"
              step={0.1}
              decimalScale={3}
              {...form.getInputProps('perm_soil_r')}
            />
            <NumberInput
              label="Permittivity (Imaginary part)"
              description="Model will calculate soil permittivity based on sm, clay, fGHz, if setting both real and imaginary number to 0."
              placeholder="Default: 0"
              step={0.1}
              decimalScale={3}
              {...form.getInputProps('perm_soil_i')}
            />
          </Group>

          {/* <Text size="sm" fw={600} mt="md">Advanced Settings</Text> */}

          {/* <Group grow>
            <Select
              label="Volume-Surface Coupling"
              data={[
                { value: '1', label: 'Enable coupling' },
                { value: '0', label: 'Volume only' },
              ]}
              {...form.getInputProps('Flag_coupling')}
            />
            <NumberInput
              label="CPU Cores"
              placeholder="Default: 10"
              min={1}
              step={1}
              {...form.getInputProps('core_num')}
            />
          </Group> */}

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

