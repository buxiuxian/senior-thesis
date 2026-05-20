import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles3.module.css';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useHistory } from 'react-router-dom';
import {translate} from '@docusaurus/Translate';

const UserList = [
  {
    Login_img:
      require('@site/static/img/Login_img.jpg').default,
  }
];

function handleRedirectLog1() {
  window.location.href = "../../../docs/category/bare-soil";
}

function Projectfun({Login_img}) {
  const [isClicked, setIsClicked] = useState(false);

  const ToRegister = () => {
    setIsClicked(!isClicked);
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
  const [password, setPassword] = useState('');

  const [FirstName, setFirstName] = useState('');
  const [LastName, setLastName] = useState('');
  const [Gender, setGender] = useState('');
  const [Country, setCountry] = useState('');

  const [Affiliation, setAffiliation] = useState('');
  const [ResearchArea, setResearchArea] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const [LoggedIn, setLogged] = useState('False');
  const history = useHistory();
  
  const handleRegister = () => {
    event.preventDefault();
    setIsLoading(true);
    setResponse(''); // 清除之前的响应
    
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
        'password': password,
        'FirstName': FirstName,
        'LastName'   : LastName,
        'Gender' : Gender,
        'Country' : Country,
        'Affiliation' : Affiliation,
        'ResearchArea': ResearchArea,
    })
    })
      .then(response => response.json())
      .then((data) => {
        setResponse(data);
        setIsLoading(false);
        if (data.result) {
          // 注册成功，跳转到登录页面
          setShowEmailDialog(true);
        } else {
          console.error('Registration failed:', data.error);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        setIsLoading(false);
        setResponse({ result: false, error: '网络错误，请稍后重试' });
      });
  };

  return (
    <div className= {styles.wrapper}>

      <div style={{borderRadius: "10px", overflow: "hidden"}}>
        <div className={styles.UserWrap}>
          
            <div style={{height: "5vh"}}></div>
            <h1>{translate({id: 'register.title', message: 'Registration'})}</h1>
            <div style={{textAlign: "left"}}>{translate({id: 'register.tip', message: 'Please fill in the required information that are needed for registration process. We encourage you to provide a valid information as it will help us to deliver the best services for you. The information provided will not be disclosed to any third parties without any further notice and agreements.'})}</div>
            <div className={styles.UserInfoCol}> 

              <div className={styles.Input_center}>
                  <div className={styles.divider} style={{marginTop: "25px", marginBottom: "15px"}}></div>
                  
                    <div className={styles.ProfileRow}>
                        <div className={styles.ProfileColumn}>
                          <div className={styles.Input_box_title}>{translate({id: 'register.profileInfo', message: 'Profile Information'})}</div>
                          <div className={styles.Input_box}>
                            <div className={styles.Input_box_desc}>{translate({id: 'register.username', message: 'Username:'})} &nbsp; </div>
                            <input type="text" id="fullname" name="fullname" onChange={(e) => setUsername(e.target.value)} required></input>
                          </div>

                          <div className={styles.Input_box}>
                            <div className={styles.Input_box_desc}>{translate({id: 'register.password', message: 'Password:'})} &nbsp; </div>
                            <input type="password" id="password" name="password" onChange={(e) => setPassword(e.target.value)} required></input>
                          </div>

                          <div className={styles.Input_box}>
                            <div className={styles.Input_box_desc}>{translate({id: 'register.confirmPassword', message: 'Confirm Password:'})} &nbsp; </div>
                            <input type="password" id="confirm-password" name="confirm-password" onChange={(e) => setPasswordCon(e.target.value)} required></input>
                          </div>
                        </div>

                        <div className={styles.Password_req}>
                          <div className={styles.Password_req_text2}>
                            {translate({id: 'register.usernameReq', message: 'The username must:'})}
                          </div>
                          <div className={styles.Password_req_text1}>
                            &#9642; {translate({id: 'register.usernameLen', message: 'Be no less than 2 characters'})}
                          </div>
                          <div className={styles.Password_req_text1}>
                            &#9642; {translate({id: 'register.usernameChar', message: 'Does not contain special character, such as: /, <>'})}
                          </div>
                          <div className={styles.Password_req_text2}>
                            {translate({id: 'register.passwordReq', message: 'The password must:'})}
                          </div>
                          <div className={styles.Password_req_text1}>
                            &#9642; {translate({id: 'register.passwordLen', message: 'Be 8-26 digits long'})}
                          </div>
                          <div className={styles.Password_req_text1}>
                            &#9642; {translate({id: 'register.passwordCase', message: 'Contain at least one uppercase and lowercase letters'})}
                          </div>
                          <div className={styles.Password_req_text1}>
                            &#9642; {translate({id: 'register.passwordNum', message: 'Use at least one number and special character'})}
                          </div>
                        </div>
                    </div>
                    
                  <div className={styles.divider}></div>

                  <div className={styles.Input_box_title}>{translate({id: 'register.userInfo', message: 'User Information'})}</div>
                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.email', message: 'Email:'})} &nbsp; </div>
                    <input type="email" id="email" name="email" onChange={(e) => setEmail(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.firstName', message: 'First Name:'})} &nbsp; </div>
                    <input type="text" id="FirstName" name="FirstName" onChange={(e) => setFirstName(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.lastName', message: 'Last Name:'})} &nbsp; </div>
                    <input type="text" id="LastName" name="LastName" onChange={(e) => setLastName(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.gender', message: 'Gender:'})} &nbsp; </div>
                    <input type="text" id="Gender" name="Gender" onChange={(e) => setGender(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.country', message: 'Country:'})} &nbsp; </div>
                    <input type="text" id="Country" name="Country" onChange={(e) => setCountry(e.target.value)} required></input>
                  </div>

                  <div className={styles.divider}></div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.affiliation', message: 'Affiliation:'})} &nbsp; </div>
                    <input type="text" id="Affiliation" name="Affiliation" onChange={(e) => setAffiliation(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.institution', message: 'Institution:'})} &nbsp; </div>
                    <input type="text" id="institution" name="institution" onChange={(e) => setInstitution(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <div className={styles.Input_box_desc}>{translate({id: 'register.researchArea', message: 'Research Area:'})} &nbsp; </div>
                    <input type="text" id="ResearchArea" name="ResearchArea" onChange={(e) => setResearchArea(e.target.value)} required></input>
                  </div>

              </div>

              {response && (
                  <div className={styles.Register_Finalstat}>
                    <p style={{ color: response.result ? 'green' : 'red' }}>
                      {response.result ? "Successfully Registerd! Please check your email for activation your account" : response.error}
                    </p>
                  </div>
              )}

              <button 
                className={styles.Submit_button} 
                type="submit" 
                onClick={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? translate({id: 'register.loading', message: '注册中...'}) : translate({id: 'register.button', message: 'REGISTER'})}
              </button>

              {showEmailDialog && (
                <div className={styles.DialogOverlay} role="dialog" aria-modal="true">
                  <div className={styles.DialogCard}>
                    <div className={styles.DialogTitle}>
                      {translate({id: 'register.checkEmailTitle', message: 'Please check your email'})}
                    </div>
                    <div className={styles.DialogBody}>
                      {translate({id: 'register.checkEmailBody', message: 'We sent a confirmation email. Please check your inbox to complete registration.'})}
                    </div>
                    <button
                      type="button"
                      className={styles.DialogButton}
                      onClick={() => history.push('/Login')}
                    >
                      {translate({id: 'register.readyToLogin', message: 'Read to login'})}
                    </button>
                  </div>
                </div>
              )}

            </div>
        </div>
      </div>
    </div> 
  );
}

export default function ProjectPage1() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {UserList.map((props, idx) => (
            <Projectfun key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

