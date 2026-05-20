import React, { useState, useEffect } from 'react';
import Layout from '@theme/Layout';
import { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import { Grid, Box, Paper, Modal, Group, Text } from '@mantine/core';
import RSAgentChat from '../components/RSAgentChat';
import TaskList from '../components/TaskList';
import TaskSubmitButton from '../components/TaskSubmitButton';
import CreditDisplay from '../components/CreditDisplay';
import FAQSection from '../components/FAQSection';
import SoilTaskForm from '../components/forms/SoilTaskForm';
import SnowTaskForm from '../components/forms/SnowTaskForm';
import VegetationTaskForm from '../components/forms/VegetationTaskForm';
import { useUserAuth } from '../components/UserAuthContext';
import styles from './GettingStarted.module.css';

function GettingStartedInner() {
  const { isLoggedIn, username } = useUserAuth();
  const [soilFormOpened, setSoilFormOpened] = useState(false);
  const [snowFormOpened, setSnowFormOpened] = useState(false);
  const [vegFormOpened, setVegFormOpened] = useState(false);
  const [snowAlgorithm, setSnowAlgorithm] = useState('snow-tri');

  const handleModelSelect = (model) => {
    switch(model) {
      case 'soil':
        setSoilFormOpened(true);
        break;
      case 'snow-tri':
        setSnowAlgorithm('snow-tri');
        setSnowFormOpened(true);
        break;
      case 'snow-bic':
        setSnowAlgorithm('snow-bic');
        setSnowFormOpened(true);
        break;
      case 'snow-qms':
        setSnowAlgorithm('snow-qms');
        setSnowFormOpened(true);
        break;
      case 'vegetation':
        setVegFormOpened(true);
        break;
      default:
        break;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className={styles.agentPage}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginPromptContent}>
            <div className={styles.loginIcon}></div>
            <h3>{translate({id: 'agent.loginRequired', message: 'Please sign in'})}</h3>
            <p>{translate({id: 'agent.loginMessage', message: 'Please sign in to RSHub to use AI agent'})}</p>
            <a href="/Login" className={styles.loginButton}>
              {translate({id: 'agent.loginButtonText', message: 'Please sign'})}
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <Heading as="h1" className={styles.heroTitle}>
            Getting Started with RSHub
          </Heading>
          <p className={styles.heroSubtitle}>
            Submit tasks, interact with AI agent, and manage your computational workflows
          </p>
          
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <h3>Agent Q&A</h3>
              <p>Professional agent Q&A system based on user technical report and extensive scientific literature</p>
            </div>
            <div className={styles.featureCard}>
              <h3>Modeling</h3>
              <p>Intelligently identifies modeling requirements, automatically submits computation tasks to RSHub, and delivers modeling results.</p>
            </div>
            <div className={styles.featureCard}>
              <h3>Analysis</h3>
              <p>Interactive analysis system to analyze model results</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <Grid gutter={0} className={styles.splitGrid}>
          <Grid.Col span={{ base: 12, md: 7 }} className={styles.leftPanel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Welcome, {username}</h2>
            </div>
            <div className={styles.chatWrapper}>
              <RSAgentChat 
                apiBaseUrl="https://rshub.zju.edu.cn/backend-rsagent"
                showBilling={false}
              />
            </div>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }} className={styles.rightPanel}>
            <div className={styles.panelHeader}>
              <Group justify="space-between" align="center" w="100%">
                <TaskSubmitButton onSelectModel={handleModelSelect} />
                <CreditDisplay />
              </Group>
            </div>
            <div className={styles.taskListWrapper}>
              <TaskList />
            </div>
          </Grid.Col>
        </Grid>
      </div>

      <div className={styles.qaSection}>
        <div className={styles.qaContent}>
          <Heading as="h2" className={styles.qaTitle}>
            Frequently Asked Questions
          </Heading>
          <p className={styles.qaSubtitle}>
            Find answers to common questions about RSHub platform and modeling workflows
          </p>
          <FAQSection />
        </div>
      </div>

      <SoilTaskForm 
        opened={soilFormOpened} 
        onClose={() => setSoilFormOpened(false)} 
      />
      
      <SnowTaskForm 
        opened={snowFormOpened} 
        onClose={() => setSnowFormOpened(false)}
        algorithm={snowAlgorithm}
      />
      
      <VegetationTaskForm 
        opened={vegFormOpened} 
        onClose={() => setVegFormOpened(false)} 
      />
    </div>
  );
}

class GettingStartedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Getting Started Page Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Layout
          title={translate({id: 'gettingStarted.title', message: 'Getting Started'})}
          description={translate({id: 'gettingStarted.description', message: 'RSHub Getting Started - Submit tasks and interact with AI agent'})}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '4rem 2rem',
            textAlign: 'center',
            minHeight: '500px'
          }}>
            <h1 style={{ color: '#B08EAD', marginBottom: '1rem' }}>Page Load Error</h1>
            <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
              Sorry, Getting Started page encountered an error. Please refresh and try again.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #B08EAD 0%, #85A0BF 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Refresh Page
            </button>
          </div>
        </Layout>
      );
    }

    return this.props.children;
  }
}

export default function GettingStarted() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <Layout
        title={translate({id: 'gettingStarted.title', message: 'Getting Started'})}
        description={translate({id: 'gettingStarted.description', message: 'RSHub Getting Started - Submit tasks and interact with AI agent'})}
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '4rem 2rem',
          textAlign: 'center',
          minHeight: '500px'
        }}>
          <h1 style={{ color: '#B08EAD', marginBottom: '1rem' }}>Loading Getting Started...</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={translate({id: 'gettingStarted.title', message: 'Getting Started'})}
      description={translate({id: 'gettingStarted.description', message: 'RSHub Getting Started - Submit tasks and interact with AI agent'})}
    >
      <GettingStartedErrorBoundary>
        <GettingStartedInner />
      </GettingStartedErrorBoundary>
    </Layout>
  );
}

