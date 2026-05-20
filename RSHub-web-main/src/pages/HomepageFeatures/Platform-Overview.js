import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import { translate } from '@docusaurus/Translate';
import Link from '@docusaurus/Link';
import { Container, Title, Text, Card, Group, Badge, SimpleGrid, Stack, Button } from '@mantine/core';
import { useMemo } from 'react';

const FeatureList = [
  {
    title: translate({id: 'homepage.platformOverview', message: 'Platform Overview'}),
    pic : require('@site/static/img/platform.jpg').default,
    icons : 
      [require('@site/static/img/Feature1.png').default, 
      require('@site/static/img/Feature2.png').default],
    
    features_ : 
      [translate({id: 'homepage.agility', message: 'Agility'}), 
      translate({id: 'homepage.multiPurpose', message: 'Multi-Purpose'})],
    
    features_desc : 
      [translate({id: 'homepage.agilityDesc', message: 'It is an integrated system that gives users easy access to simulate scattering variables under different scenarios using a unified interface. It alleviates the burdens of setting up environments and installing dependencies.'}),
      translate({id: 'homepage.multiPurposeDesc', message: 'It supports multiple scenarios in remote sensing and supports the simulation of diverse scattering observation variables and the corresponding byproducts/ internal variables to facilitate the interpretation of the model outputs.'})],
    
    sscenario_ : 
      [translate({id: 'homepage.bareSoil', message: 'Bare Soil'}), 
      translate({id: 'homepage.vegetationCoveredSoil', message: 'Vegetation-covered Soil'}), 
      translate({id: 'homepage.snowCoveredSoil', message: 'Snow-covered soil'})],
    
    sscenario_desc: 
      [translate({id: 'homepage.bareSoilDesc', message: 'Bare Soil Description here'}), 
      translate({id: 'homepage.vegetationCoveredSoilDesc', message: 'Vegetation-covered Soil Description here'}),
      translate({id: 'homepage.snowCoveredSoilDesc', message: 'Snow-covered Soil description here'})],

    soil_img:
      [require('@site/static/img/Scenario1.jpg').default,
      require('@site/static/img/Scenario2.jpg').default,
      require('@site/static/img/Scenario3.png').default],

    three_step:
    [require('@site/static/img/1_Define_Scenario.gif').default,
    require('@site/static/img/2_Run_code.gif').default,
    require('@site/static/img/3_Analysis.gif').default,
    require('@site/static/img/1_Define_Scenario.png').default,
    require('@site/static/img/2_Run_code.png').default,
    require('@site/static/img/3_Analysis.png').default],
    
    end_credit_img:
      require('@site/static/img/Credit1.jpg').default,
    
    ZJUI_UIUC:
      require('@site/static/img/rshub.png').default,

     description: (
      <>
        {translate({id: 'homepage.platformDesc', message: 'Remote Sensing Hub (RSHub) is a shared cloud computing platform for the remote sensing community to compute microwave scattering properties based on microwave electromagnetic scattering mechanisms.'})}
      </>
    ),

  }
  // {
  //   title: 'Focus on What Matters',
  //   Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
  //   description: (
  //     <>
  //       Docusaurus lets you focus on your docs, and we&apos;ll do the chores. Go
  //       ahead and move your docs into the <code>docs</code> directory.
  //     </>
  //   ),
  // },
  // {
  //   title: 'Powered by React',
  //   Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
  //   description: (
  //     <>
  //       Extend or customize your website layout by reusing React. Docusaurus can
  //       be extended while reusing the same header and footer.
  //     </>
  //   ),
  // },
];

function handleRedirect1() {
  window.location.href = "./docs/category/soil-scenarios";
}

function handleRedirect2() {
  window.location.href = "./docs/category/vegetation-scenarios";
}

function handleRedirect3() {
  window.location.href = "./docs/category/snow-scenarios";
}

function handletoDocumentation() {
  window.location.href = "./Documentation";
}

function handletoContact() {
  window.location.href = "./Contact-Information";
}

function handletoAcknowledgments() {
  window.location.href = "./Acknowledgements";
}

function handletoWebUsage() {
  window.location.href = "https://github.com/zjuiEMLab/RShub_demo";
}

function Feature({title, pic,description, icons, features_, features_desc, sscenario_, sscenario_desc, soil_img, end_credit_img, ZJUI_UIUC, three_step}) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className={styles.modernWrapper}>
      {/* Platform Overview Section - Apple Style */}
      <Container size="xl" py={80}>
        <Stack align="center" gap="xl">
          <Title 
            order={2} 
            className={styles.sectionTitle}
            ta="center"
          >
            {title}
          </Title>
          <Text 
            size="xl" 
            c="dimmed" 
            maw={800} 
            ta="center"
            className={styles.sectionDescription}
          >
            {description}
          </Text>
          <img 
            src={pic} 
            alt="Platform Overview"
            className={styles.platformImage}
          />
        </Stack>
      </Container>

      {/* Why RSHub - Modern Cards */}
      <Container size="xl" py={80} className={styles.whySection}>
        <Stack align="center" gap="xl" mb={60}>
          <Title order={2} className={styles.sectionTitle}>
            {translate({id: 'homepage.whyRShub', message: 'Why RSHub?'})}
          </Title>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
          <Card 
            shadow="sm" 
            padding="xl" 
            radius="lg"
            className={styles.featureCard}
          >
            <Stack align="center" gap="md">
              <img 
                src={icons[0]} 
                alt={features_[0]}
                className={styles.featureIcon}
              />
              <Title order={3} size="h3" ta="center">
                {features_[0]}
              </Title>
              <Text size="md" c="dimmed" ta="center">
                {features_desc[0]}
              </Text>
            </Stack>
          </Card>

          <Card 
            shadow="sm" 
            padding="xl" 
            radius="lg"
            className={styles.featureCard}
          >
            <Stack align="center" gap="md">
              <img 
                src={icons[1]} 
                alt={features_[1]}
                className={styles.featureIcon}
              />
              <Title order={3} size="h3" ta="center">
                {features_[1]}
              </Title>
              <Text size="md" c="dimmed" ta="center">
                {features_desc[1]}
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </Container>

      {/* Supported Scenarios - Apple Style Grid */}
      <Container size="xl" py={80} className={styles.scenariosSection}>
        <Stack align="center" gap="xl" mb={60}>
          <Group gap="xs">
            <Text size="xl" fw={300} c="dimmed">
              {translate({id: 'homepage.supported', message: 'Supported'})}
            </Text>
            <Text size="xl" fw={700} c="teal">
              {translate({id: 'homepage.multiple', message: 'Multiple'})}
            </Text>
            <Text size="xl" fw={300} c="dimmed">
              {translate({id: 'homepage.scenarios', message: 'Scenarios'})}
            </Text>
          </Group>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl">
          <Card 
            shadow="md" 
            padding="lg" 
            radius="lg"
            className={styles.scenarioCard}
            onClick={handleRedirect1}
            style={{ cursor: 'pointer' }}
          >
            <Card.Section>
              <img 
                src={soil_img[0]}
                alt={sscenario_[0]}
                className={styles.scenarioImage}
              />
            </Card.Section>
            <Stack mt="md" gap="xs">
              <Title order={4} size="h4">
                {sscenario_[0]}
              </Title>
              <Text size="sm" c="dimmed">
                {sscenario_desc[0]}
              </Text>
            </Stack>
          </Card>

          <Card 
            shadow="md" 
            padding="lg" 
            radius="lg"
            className={styles.scenarioCard}
            onClick={handleRedirect2}
            style={{ cursor: 'pointer' }}
          >
            <Card.Section>
              <img 
                src={soil_img[1]}
                alt={sscenario_[1]}
                className={styles.scenarioImage}
              />
            </Card.Section>
            <Stack mt="md" gap="xs">
              <Title order={4} size="h4">
                {sscenario_[1]}
              </Title>
              <Text size="sm" c="dimmed">
                {sscenario_desc[1]}
              </Text>
            </Stack>
          </Card>

          <Card 
            shadow="md" 
            padding="lg" 
            radius="lg"
            className={styles.scenarioCard}
            onClick={handleRedirect3}
            style={{ cursor: 'pointer' }}
          >
            <Card.Section>
              <img 
                src={soil_img[2]}
                alt={sscenario_[2]}
                className={styles.scenarioImage}
              />
            </Card.Section>
            <Stack mt="md" gap="xs">
              <Title order={4} size="h4">
                {sscenario_[2]}
              </Title>
              <Text size="sm" c="dimmed">
                {sscenario_desc[2]}
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </Container>


      {/* Modern Footer */}
      <footer className={styles.modernFooter}>
        <Container size="xl">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl">
            <Stack gap="md">
              <Title order={4} c="white" className={styles.footerTitle}>
                {translate({id: 'homepage.documentation', message: 'Documentation'})}
              </Title>
              <Stack gap="xs">
                <Text 
                  component="a" 
                  href="#" 
                  className={styles.footerLink}
                  onClick={handletoDocumentation}
                >
                  {translate({id: 'homepage.publications', message: 'Publications'})}
                </Text>
                <Text component="span" className={styles.footerLink}>
                  {translate({id: 'homepage.presentations', message: 'Presentations'})}
                </Text>
                <Text component="span" className={styles.footerLink}>
                  {translate({id: 'homepage.codeExamples', message: 'Code Examples'})}
                </Text>
                <Text component="span" className={styles.footerLink}>
                  {translate({id: 'homepage.qa', message: 'Q&A'})}
                </Text>
              </Stack>
            </Stack>

            <Stack gap="md">
              <Title order={4} c="white" className={styles.footerTitle}>
                {translate({id: 'homepage.contactUs', message: 'Contact Us'})}
              </Title>
              <Stack gap="sm">
                <Group gap="xs">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
                  </svg>
                  <Text 
                    component="a" 
                    href="mailto:rshub@intl.zju.edu.cn"
                    className={styles.footerLink}
                    size="sm"
                  >
                    rshub@intl.zju.edu.cn
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{marginTop: '2px'}}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <Text 
                    component="a"
                    href="https://zjui.intl.zju.edu.cn/research/electromagnetics/EMSL/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                    size="sm"
                    style={{flex: 1, wordBreak: 'break-word'}}
                  >
                    zjui.intl.zju.edu.cn/research/electromagnetics/EMSL/
                  </Text>
                </Group>
              </Stack>
            </Stack>

            <Stack gap="md">
              <Title order={4} c="white" className={styles.footerTitle}>
                {translate({id: 'homepage.acknowledgements', message: 'Acknowledgements'})}
              </Title>
              <Text 
                component="span" 
                className={styles.footerLink}
                onClick={handletoAcknowledgments}
                style={{cursor: 'pointer'}}
              >
                {translate({id: 'homepage.projectSupport', message: 'Project Support'})}
              </Text>
            </Stack>
          </SimpleGrid>

          <div className={styles.footerBottom}>
            <Text size="sm" c="dimmed" ta="center" suppressHydrationWarning>
              © {currentYear} Remote Sensing Hub. All rights reserved.
            </Text>
          </div>
        </Container>
      </footer>
    </div>
          
  );

}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

