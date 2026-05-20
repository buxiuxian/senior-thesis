import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles1.module.css';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useUserAuth } from '../../components/UserAuthContext';
import {translate} from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';

const LoginList = [
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

function Login({Login_img}) {
  const [isClicked, setIsClicked] = useState(false);
  const { login } = useUserAuth();

  const ToReset = () => {
    setIsClicked(!isClicked);
  };

  const ToRegister = () => {
    window.location.href = '/Registration';
  };

  const history = useHistory();
  const userPageUrl = useBaseUrl('/UserPage');
    const [LoggedIn, setLogged] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [response, setResponse] = useState('');
    const handleLogin = async (event) => {
      event.preventDefault();
      try {
        const response = await fetch('https://rshub.zju.edu.cn/users/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            'username': username,
            'password': password
          })
        });
        
        const data = await response.json();
        setResponse(data);
        setLogged('True');
        
        if (data.result) {
          await login(data.tokenTmp, { username: username });
          history.push(userPageUrl);
        } else {
          console.error('Login failed:', data.error);
        }
      } catch (error) {
        console.error('Error:', error);
        setResponse({ error: 'Login failed. Please try again.' });
      }
    };

    const [email, setEmail] = useState('');
    const [reset_email, setREmail] = useState('');
    const [reset_username, setRUsername] = useState('');
    const [responseReg, setResponseReg] = useState('');

    const handleResetPassword = () => {
      event.preventDefault()
      fetch('https://rshub.zju.edu.cn/users/api/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'email' : reset_email,
          'username': reset_username
      })
      })
        .then(response => response.json())
        .then((data) => {
          setResponseReg(data);
          setLogged('True');
          if (data.result) {
           // Store the token in local storage or session storage
          if (typeof window !== 'undefined') {
            localStorage.setItem('LoggedIn', LoggedIn)
            localStorage.setItem('tokenTmp', data.tokenTmp);
          }
          // Redirect to UserPage
          window.location.href = '/ResetSuccess';
          } else {
            console.error('Reset failed:', data.error);
          }
        })
        .catch(error => console.error('Error:', error));
    };

  return (
    <div className= {styles.wrapper}>
      <div style={{borderRadius: "10px", overflow: "hidden"}}>
        <div className= {styles.Login_Wrap}>
          <div className= {styles.Form_Wrap}>

            <div className= {isClicked ? styles.Login_Formde : styles.Login_Form}>
              <form action="">
                <h1>{translate({id: 'login.title', message: 'Login'})}</h1>
                <div className={styles.Input_center}>
                  <div className={styles.Input_box}>
                    <input name = "username" type="text" placeholder={translate({id: 'login.username', message: 'Username'})} value={username} onChange={(e) => setUsername(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <input name = "password" type="password" placeholder={translate({id: 'login.password', message: 'Password'})} value={password} onChange={(e) => setPassword(e.target.value)} required></input>
                  </div>
                </div>

                <button type="submit" onClick={handleLogin} value="Login">
                  {translate({id: 'login.button', message: 'Login'})}
                </button>
                {response && (
                  <div>
                    <p>{response.result ? translate({id: 'login.success', message: 'Login Succesful'}) : response.error}</p>
                  </div>
                )}

                <div style={{paddingBottom: "0.5rem"}}>          
                  {translate({id: 'login.forget', message: 'Forget Password?'})} {' '}
                  <a href="#" onClick={ToReset}>
                    {translate({id: 'login.reset', message: 'Reset your password Here'})}
                  </a>
                </div>

                <div>
                  <p> 
                    {translate({id: 'login.noaccount', message: "Don't have an account?"})} {' '}
                    <a href="#" onClick={ToRegister}>
                      {translate({id: 'login.register', message: 'Register Here'})}
                    </a>
                  </p>
                </div>
              </form>
            </div>  

            <div className={isClicked ? styles.Register : styles.Registerde}>
              <form styles={{display: "flex", flexDirection: "column"}} action="">
                <h1>
                  {translate({id: 'login.resetTitle', message: 'Password Reset'})}
                </h1>
                <div className={styles.Input_center}>
                  <div className={styles.Input_box}>
                    <input type="username" id="reset_username" name="fullname" placeholder={translate({id: 'login.username', message: 'Username'})} onChange={(e) => setRUsername(e.target.value)} required></input>
                  </div>

                  <div className={styles.Input_box}>
                    <input type="email" id="reset_email" name="email" placeholder={translate({id: 'login.email', message: 'E-mail'})} onChange={(e) => setREmail(e.target.value)} required></input>
                  </div>
                </div>

                <button type="submit" onClick={handleResetPassword}>
                  {translate({id: 'login.resetButton', message: 'Reset'})}
                </button>
                
                {responseReg && (
                  <div>
                    <p>{responseReg.result ? translate({id: 'login.regsuccess', message: 'Registration Succesful'}) : responseReg.error}</p>
                  </div>
                )}
                <div className='register'>
                  <p> 
                    {translate({id: 'login.already', message: 'Already have an account?'})} {' '}
                    <a href="#" onClick={ToReset}>
                      {translate({id: 'login.loginHere', message: 'Login Here'})}
                    </a>
                  </p>
                </div>

                
              </form>
            </div>
          </div>

          <div className= {styles.Login_Img}>
            <img src={Login_img}></img>
          </div>
        </div>
      </div>
    </div> 
  );
}

export default function LoginPage() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {LoginList.map((props, idx) => (
            <Login key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

