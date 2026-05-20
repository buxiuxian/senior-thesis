import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from './HomepageFeatures/Platform-Overview';
import { translate } from '@docusaurus/Translate';
import { Button, Container, Title, Text, Box } from '@mantine/core';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <div className={styles.heroWrapper}>
      <div className={styles.heroOverlay} />
      <header className={clsx(styles.heroBanner)}>
        <Container size="lg" className={styles.heroContainer}>
          <Title order={1} className={styles.heroTitle}>
            {translate({id: 'homepage.siteTitle', message: 'Remote Sensing Hub'})}
          </Title>
          
          <Text className={styles.heroSubtitle} size="xl" mt="md">
            {translate({id: 'homepage.siteTagline', message: 'A shared cloud computing platform for the remote sensing community to compute microwave scattering'})}
          </Text>
          
          <Box className={styles.heroButtons} mt="xl">
            <Link to="/GettingStarted" style={{ textDecoration: 'none' }}>
              <Button 
                size="xl" 
                className={styles.ctaButton}
                variant="filled"
              >
                {translate({id: 'homepage.getStarted', message: 'Get Started'})}
              </Button>
            </Link>
            
            <Link to="/docs/Scenarios" style={{ textDecoration: 'none', marginLeft: '1rem' }}>
              <Button 
                size="xl" 
                variant="outline"
                className={styles.secondaryButton}
              >
                {translate({id: 'homepage.learnMore', message: 'Learn More'})}
              </Button>
            </Link>
          </Box>
        </Container>
      </header>
    </div>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={` ${translate({id: 'homepage.siteTitle', message: 'Remote Sensing Hub'})}`}
      description="A shared cloud computing platform for microwave scattering modeling">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
