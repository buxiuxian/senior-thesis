import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles2.module.css';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {translate} from '@docusaurus/Translate';

const UserList = [
  {
    Login_img:
      require('@site/static/img/Login_img.jpg').default,
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

function handleRedirectLog1() {
  window.location.href = "../../../docs/category/bare-soil";
}

function Userfun({}) {
  const [ProfileTab, setProfile] = useState(true);
  const [ProjectTab, setProject] = useState(false);

  const ToProfile = () => {
    setProfile(true);
    setProject(false);
  };

  const ToProject = () => {
    setProfile(false);
    setProject(true);
  };

  const [tokenTmp, setTokenTmp] = useState(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTokenTmp(localStorage.getItem('tokenTmp'));
    }
  }, []);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tokenTmp) {
      fetch('https://rshub.zju.edu.cn/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenTmp: tokenTmp
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then((data) => setProfileData(data))
        .catch((error) => {
          console.error('Error:', error);
          setError(error);
        });
    }
    return () => {
      setProfileData(null);
    };
  }, [tokenTmp]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [confirm_password, setPasswordCon] = useState('');

  const handleRegister = () => {
    event.preventDefault()
    fetch('https://rshub.zju.edu.cn/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'username': username,
        'email'   : email,
        'institution' : institution,
        'confirm_password' : confirm_password,
        'password': password
    })
    })
      .then(response => response.json())
      .then(data => setResponse(data))
      .catch(error => console.error('Error:', error));
  };

  const [ProfileTabz, setProfileTab] = useState(styles.ProfileTabA);
  const [ProjectTabz, setProjectTab] = useState(styles.ProjectTabD);
  
  const ProfileTabClick = () => {
      setProfileTab(styles.ProfileTabA);
      setProjectTab(styles.ProjectTabD);

    ToProfile();
  };

  const ProjectTabClick = () => {
      setProfileTab(styles.ProfileTabD);
      setProjectTab(styles.ProjectTabA);
 
    ToProject();
  };

  return (
    <div className= {styles.wrapper}>

      <div style={{borderRadius: "10px", overflow: "hidden"}}>
        <div className={styles.UserWrap}>
          <div style={{ fontWeight: "bold", fontSize: "2rem"}}>
            {translate({id: 'reset.successTitle', message: 'Request to reset password succeed'})}
          </div>
          <div style={{fontSize: "1.2rem", paddingTop: "0.7rem", width: "60vw"}}>
            {translate({id: 'reset.successTip', message: 'A confirmation email has been sent to your email address, please access your email and click through the link to set your new password.'})}
          </div>
        </div>
      </div>
    </div> 
  );
}

export default function ResetSuccessPage1() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {UserList.map((props, idx) => (
            <Userfun key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

