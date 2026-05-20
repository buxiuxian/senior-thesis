import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import ResetSuccessPage1 from './ResetSuccessPage/ResetSuccess1';
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
      <main >
        <ResetSuccessPage1 />
      </main>
    </Layout>
  );
}
