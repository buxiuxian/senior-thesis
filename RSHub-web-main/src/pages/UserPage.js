import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import UserPage1 from './UserPage1/UserPage1';
// import { UserAuthProvider } from '../components/UserAuthContext';
// import CustomNavbar from '../components/CustomNavbar';

import Heading from '@theme/Heading';
import styles from './index.module.css';


export default function UserPage() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={` ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      {/* <CustomNavbar /> */}
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '90vh', padding: '2rem 1rem' }}>
        <UserPage1 />
      </main>
    </Layout>
  );
}
