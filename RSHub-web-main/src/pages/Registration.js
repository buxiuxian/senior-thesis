import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import RegisterPage1 from './RegisterPage1/RegisterPage1';
// import { UserAuthProvider } from '../components/UserAuthContext';
// import CustomNavbar from '../components/CustomNavbar';

import Heading from '@theme/Heading';
import styles from './index.module.css';


export default function Registration() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={` ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      {/* <CustomNavbar /> */}
      <main >
        <RegisterPage1 />
      </main>
    </Layout>
  );
}
