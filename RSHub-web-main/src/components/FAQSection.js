import React, { useState } from 'react';
import { Accordion, Text } from '@mantine/core';
import styles from './FAQSection.module.css';

export default function FAQSection() {
  const faqData = [
    {
      category: "RSHub Quick Start",
      questions: [
        {
          q: "How do I get a token and set up the environment?",
          a: "Register and log in at https://rshub.zju.edu.cn/Login/# to obtain your personal token; install Python > 3.8 locally and run `pip install rshub`."
        },
        {
          q: "How do I submit a job?",
          a: `Use submit_jobs.run. Key fields: scenario_flag (soil/snow/veg), algorithm (e.g., veg: rt; snow: qms/bic), output_var (tb or sigma), fGHz, scatters (model parameters), project_name, task_name, token.

Example:
from rshub import submit_jobs
data = {
    "scenario_flag": "snow",
    "algorithm": "bic",
    "output_var": "tb",
    "fGHz": [9.6, 13.4, 17.2],
    "scatters": {},  # fill with parameters
    "project_name": "demo_proj",
    "task_name": "bic_test",
    "token": "YOUR_TOKEN",
    "level_required": 1,
}
result = submit_jobs.run(data)`
        },
        {
          q: "How do I check job status and errors?",
          a: "Use submit_jobs.check_completion(token, project_name, task_name) for status; on failure call load_file(...).load_error_message() for logs."
        },
        {
          q: "How do I download and view results?",
          a: "Call load_file(token, project_name, task_name, scenario_flag, algorithm, output_var, size_threshold_mb=50).load_outputs(). Large files switch to disk download automatically; returns a dict (e.g., TU_all, theta_obs), access by keys for plotting/post-processing."
        }
      ]
    },
    {
      category: "DMRT-BIC / DMRT-QMS (Soil / Snow / Observation Parameters)",
      questions: [
        {
          q: "How to choose output type?",
          a: "output_var: 'tb' for brightness temperature, 'sigma' for backscatter."
        },
        {
          q: "How to set observation parameters?",
          a: "fGHz: frequency list (common [9.6, 13.4, 17.2, 18.7, 37]; LUT matches nearest); angle/deg0inc: incidence angle list (e.g., [30, 40, 50])."
        },
        {
          q: "How to organize snow layer parameters?",
          a: "Provide equal-length arrays per layer: depth (cm) / rho (g/cm³) / Tsnow (K). BIC uses zp (b) and kc (zeta) for grain distribution; QMS uses dia (grain size, cm) and tau (stickiness/optical depth). Layer counts must match."
        },
        {
          q: "What soil/surface parameters are available?",
          a: "Tg: ground temperature; mv: soil moisture; clayfrac: clay fraction; epsr_ground_r/i: custom dielectric; surf_model_setting controls surface model and roughness (active: 1 OH / 2 SPM3D / 3 NMM3D LUT + rms height + correlation length ratio; passive: 1 Q/H + roughness factor + polarization mixing factor)."
        },
        {
          q: "When to use LUT vs high-accuracy computation?",
          a: "For BIC, lut_flag=1 uses LUT (fv, kc, zp, fGHz within supported ranges, nearest match); lut_flag=0 calls NMM3D explicit computation (slower, more precise). For finer grids, tune integration/discretization params (e.g., Nquad)."
        },
        {
          q: "Differences between BIC and QMS?",
          a: "Outputs are consistent; microstructure differs: BIC uses zp/kc, QMS uses dia/tau. Choose based on available grain descriptors."
        }
      ]
    },
    {
      category: "VPRT Model (Soil / Vegetation / Observation Parameters)",
      questions: [
        {
          q: "How to set observation and model controls?",
          a: "fGHz: frequency (default 1.41 GHz); Flag_coupling=1 enables volume–surface coupling; Flag_forced_cal=1 forces recalculation; err is the convergence tolerance."
        },
        {
          q: "How to input vegetation parameters?",
          a: "scatters is a list of scatterers: [type (1 cylinder / 0 disc), VM, L, D, betar, density, orientation?, distribution, ...] filled in the given order; veg_height: vegetation height; Tveg: vegetation temperature. Keep order/dimensions consistent with the example."
        },
        {
          q: "How to set soil parameters?",
          a: "sm: soil moisture; clay: clay fraction; perm_soil_r/i for direct dielectric assignment; rmsh: RMS height; corlength: correlation length; rough_type: correlation function (1 Gaussian / 2 Exponential); Tgnd: ground temperature."
        },
        {
          q: "How to read results?",
          a: "load_outputs returns TU_all (brightness temperature matrix), theta_obs (incident angles), etc. Confirm coupling switch and scatterer settings match your scene before inversion or comparison."
        }
      ]
    },
    {
      category: "Input Checks & Common Pitfalls",
      questions: [
        {
          q: "What if layer counts or array lengths differ?",
          a: "Arrays like depth/rho/Tsnow must be the same length; otherwise jobs fail or results are unreliable."
        },
        {
          q: "What if default roughness/model is unsuitable?",
          a: "DMRT series: adjust surf_model_setting; VPRT: tune rough_type, rmsh, corlength, and enable Flag_coupling if needed."
        },
        {
          q: "How to do parameter sensitivity?",
          a: "Use defaults as baseline, vary one parameter at a time (e.g., fGHz, rho, mv, rmsh), observe outputs, then adjust combinations."
        }
      ]
    }
  ];

  return (
    <div className={styles.faqSection}>
      {faqData.map((category, catIndex) => (
        <div key={catIndex} className={styles.categoryBlock}>
          <h3 className={styles.categoryTitle}>{category.category}</h3>
          <Accordion
            variant="separated"
            classNames={{
              item: styles.accordionItem,
              control: styles.accordionControl,
              label: styles.accordionLabel,
              content: styles.accordionContent,
            }}
          >
            {category.questions.map((item, qIndex) => (
              <Accordion.Item key={qIndex} value={`${catIndex}-${qIndex}`}>
                <Accordion.Control>
                  <Text size="sm" fw={600}>Q: {item.q}</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>A:</strong> {item.a}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      ))}
      
      <div className={styles.faqFooter}>
        <Text size="sm">
          For more details, visit the official{' '}
          <a 
            href="https://github.com/zjuiEMLab/rshub/blob/main/FQA_eng.md" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.faqLink}
          >
            RSHub FAQ on GitHub
          </a>
        </Text>
      </div>
    </div>
  );
}


