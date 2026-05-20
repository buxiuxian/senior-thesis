import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles2.module.css';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { translate } from '@docusaurus/Translate';

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
  const [organization, setInstitution] = useState('');
  const [confirm_password, setPasswordCon] = useState('');

  const [downloadStatus, setDownloadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [Delete_Return, setDelete_Return] = useState('');
  const Delete = (projectName, TaskName, token) => {
    fetch('https://rshub.zju.edu.cn/users/api/delete-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'project_name': projectName,
        'task_name': TaskName,
        'token': token
    })
    })
    .then(response => {
      // Log the response status and text to see if there's an error.
      console.log(response.status); // Log HTTP status code
      return response.text(); // Get the raw response body
    })
    .then((data) => {
      console.log('Raw response data:', data); // This will show the HTML or error message returned
      try {
        const jsonData = JSON.parse(data); // Try to parse it as JSON manually
        setDelete_Return(jsonData);
        if (jsonData.result) {
          console.log('Task Deleted');
        } else {
          console.error('Delete failed:', jsonData.error);
          alert('Error deleting task: ' + jsonData.error);
        }
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        alert('Server returned an error. Please check the server logs.');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('There was an error with the delete operation');
    });
  };

  const DeleteProject = (projectName, token) => {
    fetch('https://rshub.zju.edu.cn/users/api/delete-project', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'project_name': projectName,
        'token': token
    })
    })
    .then(response => {
      // Log the response status and text to see if there's an error.
      console.log(response.status); // Log HTTP status code
      return response.text(); // Get the raw response body
    })
    .then((data) => {
      console.log('Raw response data:', data); // This will show the HTML or error message returned
      try {
        const jsonData = JSON.parse(data); // Try to parse it as JSON manually
        setDelete_Return(jsonData);
        if (jsonData.result) {
          console.log('Task Deleted');
        } else {
          console.error('Delete failed:', jsonData.error);
          alert('Error deleting task: ' + jsonData.error);
        }
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        alert('Server returned an error. Please check the server logs.');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('There was an error with the delete operation');
    });
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

  const [ProjectStatA, setProjectStatA] = useState(styles.ProjectStatAct);
  const [ProjectStatQ, setProjectStatQ] = useState(styles.ProjectStatDeact);
  const [ProjectStatIP, setProjectStatIP] = useState(styles.ProjectStatDeact);
  const [ProjectStatF, setProjectStatF] = useState(styles.ProjectStatDeact);
  const [ProjectStatC, setProjectStatC] = useState(styles.ProjectStatDeact);
  
  const ProjectStatAClick = () => {
    setProjectStatA(styles.ProjectStatAct);
    setProjectStatQ(styles.ProjectStatDeact);
    setProjectStatIP(styles.ProjectStatDeact);
    setProjectStatF(styles.ProjectStatDeact);
    setProjectStatC(styles.ProjectStatDeact);

    setToProjectAllStat(styles.TableContentA);
    setToProjectQueueStat(styles.TableContentD);
    setToProjectIPStat(styles.TableContentD);
    setToProjectFStat(styles.TableContentD);
    setToProjectCompStat(styles.TableContentD);
  };

  const ProjectStatQClick = () => {
    setProjectStatA(styles.ProjectStatDeact);
    setProjectStatQ(styles.ProjectStatAct);
    setProjectStatIP(styles.ProjectStatDeact);
    setProjectStatF(styles.ProjectStatDeact);
    setProjectStatC(styles.ProjectStatDeact);

    setToProjectAllStat(styles.TableContentD);
    setToProjectQueueStat(styles.TableContentA);
    setToProjectIPStat(styles.TableContentD);
    setToProjectFStat(styles.TableContentD);
    setToProjectCompStat(styles.TableContentD);
  };

  const ProjectStatIPClick = () => {
    setProjectStatA(styles.ProjectStatDeact);
    setProjectStatQ(styles.ProjectStatDeact);
    setProjectStatIP(styles.ProjectStatAct);
    setProjectStatF(styles.ProjectStatDeact);
    setProjectStatC(styles.ProjectStatDeact);

    setToProjectAllStat(styles.TableContentD);
    setToProjectQueueStat(styles.TableContentD);
    setToProjectIPStat(styles.TableContentA);
    setToProjectFStat(styles.TableContentD);
    setToProjectCompStat(styles.TableContentD);
  };

  const ProjectStatFClick = () => {
    setProjectStatA(styles.ProjectStatDeact);
    setProjectStatQ(styles.ProjectStatDeact);
    setProjectStatIP(styles.ProjectStatDeact);
    setProjectStatF(styles.ProjectStatAct);
    setProjectStatC(styles.ProjectStatDeact);

    setToProjectAllStat(styles.TableContentD);
    setToProjectQueueStat(styles.TableContentD);
    setToProjectIPStat(styles.TableContentD);
    setToProjectFStat(styles.TableContentA);
    setToProjectCompStat(styles.TableContentD);

  };

  const ProjectStatCClick = () => {
    setProjectStatA(styles.ProjectStatDeact);
    setProjectStatQ(styles.ProjectStatDeact);
    setProjectStatIP(styles.ProjectStatDeact);
    setProjectStatF(styles.ProjectStatDeact);
    setProjectStatC(styles.ProjectStatAct);
    
    setToProjectAllStat(styles.TableContentD);
    setToProjectQueueStat(styles.TableContentD);
    setToProjectIPStat(styles.TableContentD);
    setToProjectFStat(styles.TableContentD);
    setToProjectCompStat(styles.TableContentA);

  };

  const [ToProjectAllStat, setToProjectAllStat] = useState(styles.TableContentA);
  const [ToProjectQueueStat, setToProjectQueueStat] = useState(styles.TableContentD);
  const [ToProjectIPStat, setToProjectIPStat] = useState(styles.TableContentD);
  const [ToProjectFStat, setToProjectFStat] = useState(styles.TableContentD);
  const [ToProjectCompStat, setToProjectCompStat] = useState(styles.TableContentD);

  return (
    <div className= {styles.wrapper}>

      <div style={{borderRadius: "10px", overflow: "hidden"}}>
        <div className={styles.UserWrap}>

          <div className={styles.Upper}>
            <h1 style={{marginBottom: "5px"}}>{translate({id: 'user.welcomeBack', message: 'Welcome Back'})}</h1> 
            <div>
                {profileData && (
                <div>
                  {profileData.result ? profileData.username : profileData.error}
                </div>
                )}
            </div>
            <div>
                {translate({id: 'user.deskboardDesc', message: 'This is your deskboard, you can view your profile and ongoing projects here.'})}
            </div>

          </div>
          
          <div className={styles.TabsWrap}>
              <div className={ProfileTab ? styles.ATabs : styles.DTabs} onClick={ProfileTabClick} style={{paddingLeft: "12px"}}>
                {translate({id: 'user.profileTab', message: 'Profile'})}
                <div className={ ProfileTab ? styles.ActiveTabs : styles.DeactiveTabs }>
                </div>
              </div>

              <div className={ProjectTab ? styles.ATabs : styles.DTabs} onClick={ProjectTabClick} >
                {translate({id: 'user.projectsTab', message: 'Projects'})}
                <div className={ ProjectTab ? styles.ActiveTabs : styles.DeactiveTabs }>
                  
                </div>
              </div>
            </div>
            
          <div className={styles.Lower}>

            <div className={ProfileTabz}>
              <div id='title' style={{ fontSize: '30px', color: 'rgb(64, 64, 64)', fontWeight: '600', paddingTop: '15px', paddingBottom: '5px'}}>
                {translate({id: 'user.personalInfo', message: 'Personal Info'})}
              </div>
              <div id='description' style={{ fontSize: '17px', color: 'rgb(64, 64, 64)', fontWeight: '400'}}>
                {translate({id: 'user.personalInfoDesc', message: 'Information and details about yourself. It helps us to provide further personalize and better services for you. You can manage and updates your personal information here.'})}
              </div>
              
              <div id='LowerTabWrap' style={{display:'flex', flexDirection: 'column', width: '100%', maxWidth: '1000px', justifyContent: 'center', alignItems: 'center'}}>
                
                  <div className={styles.UserInfoRow}>
                    <div style={{ fontSize: '30px', display: 'flex', justifyContent: 'left', paddingLeft: '20px', paddingTop: '5px', marginBottom: '10px'}}>
                      {translate({id: 'user.basicInfo', message: 'Basic Info'})}
                    </div>

                    <div id='scrollbar' style={{display: 'flex', flexDirection: 'column', overflowY: 'auto'}}>
                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.username', message: 'Username'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.username : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.SSWD}>
                        &nbsp;
                      </div>

                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.firstName', message: 'First Name'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.FirstName : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.SSWD}>
                        &nbsp;
                      </div>

                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.lastName', message: 'Last Name'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.LastName : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.SSWD}>
                        &nbsp;
                      </div>

                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.gender', message: 'Gender'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.Gender : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.SSWD}>
                        &nbsp;
                      </div>

                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.country', message: 'Country'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.Country : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        &nbsp;
                      </div>

                    </div>
                      
                  </div>

                  <div className={styles.UserInfoRow}>
                    <div style={{ fontSize: '30px', display: 'flex', justifyContent: 'left', paddingLeft: '20px', paddingTop: '5px', marginBottom: '10px'}}>
                        {translate({id: 'user.contactInfo', message: 'Contact Info'})}
                    </div>

                    <div id='scrollbar' style={{display: 'flex', flexDirection: 'column', overflowY: 'auto'}}>
                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.email', message: 'Email'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.email : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        &nbsp;
                      </div>

                    </div>
                  </div>     
                
                  <div className={styles.UserInfoRow}>
                    <div style={{ fontSize: '30px', display: 'flex', justifyContent: 'left', paddingLeft: '20px', paddingTop: '5px', marginBottom: '10px'}}>
                      {translate({id: 'user.researchInfo', message: 'Research Info'})}
                    </div>

                    <div id='scrollbar' style={{display: 'flex', flexDirection: 'column', overflowY: 'hidden'}}>
                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.institution', message: 'Institution'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.organization : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.SSWD}>
                        &nbsp;
                      </div>

                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.affiliation', message: 'Affiliation'})}
                        </div>
                        <div className={styles.SSW2}>
                        {profileData && (
                            <div>
                              {profileData.result ? profileData.Affiliation : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.SSWD}>
                        &nbsp;
                      </div>

                      <div className={styles.SmallSectionWrap}>
                        <div className={styles.SSW1}>
                          {translate({id: 'user.researchArea', message: 'Research Area'})}
                        </div>
                        <div className={styles.SSW2}>
                          {profileData && (
                            <div>
                              {profileData.result ? profileData.ResearchArea : profileData.error}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        &nbsp;
                      </div>
                      
                    </div>
                  </div>
              
                
              </div>

            </div>

            <div className={ProjectTabz}>
              <div style={{borderRadius: "10px", overflowY: "auto", overflowX: "hidden", transform: "translateX(-0.7%)"}}>

                <div className={styles.UserProjects}>
                  <h2 id ='Title' style={{ fontSize: '30px', color: 'rgb(64, 64, 64)', fontWeight: '600', paddingTop:'15px', paddingBottom:'5px'}}>{translate({id: 'user.project', message: 'Project'})}</h2>
                  <div id='description' style={{ fontSize: '17px', color: 'rgb(64, 64, 64)', fontWeight: '400'}}>
                    {translate({id: 'user.projectDesc', message: 'You can view your projects status here and access them throughly, Please do not share the Token provided below to any third parties.'})}
                  </div>
                  <div className={styles.token} style={{paddingTop:'5px'}}> {translate({id: 'user.token', message: "Token (Please don't share!):"})} &nbsp;
                    {profileData && 
                    (
                      <div>
                      {profileData.result ? profileData.token : profileData.error}
                      </div>
                    )}
                  </div>
                  {Delete_Return && Delete_Return.result && <div className={styles.DownloadError}>{translate({id: 'user.deleteSuccess', message: 'Delete Succesful, please reload page'})}</div>}
                  {Delete_Return && !Delete_Return.result && <div className={styles.DownloadError}>{Delete_Return.message}</div>}
                  
                  <div className={styles.ProjectStatusC}>
                    <div className={ProjectStatA} onClick={ProjectStatAClick}>
                      {translate({id: 'user.all', message: 'All'})}
                    </div>
                    <div className={ProjectStatQ} onClick={ProjectStatQClick}>
                      {translate({id: 'user.queued', message: 'Queued'})}
                    </div>
                    <div className={ProjectStatIP} onClick={ProjectStatIPClick}>
                      {translate({id: 'user.inProgress', message: 'In progress'})}
                    </div>
                    <div className={ProjectStatF} onClick={ProjectStatFClick}>
                      {translate({id: 'user.failed', message: 'Failed'})}
                    </div>
                    <div className={ProjectStatC} onClick={ProjectStatCClick}>
                      {translate({id: 'user.completed', message: 'Completed'})}
                    </div>
                  </div>
                  <div className={styles.ProjectListC}>
                    <div>
                      <div className={styles.Table}>
                        <div className={styles.TableHeader}>
                          <div className={styles.HeaderType1}>
                            {translate({id: 'user.project', message: 'Project'})}
                          </div>

                          <div className={styles.HeaderType2}>
                            {translate({id: 'user.task', message: 'Task'})}
                          </div>

                          <div className={styles.HeaderType3}>
                            {translate({id: 'user.submission', message: 'Submission'})}
                          </div>

                          <div className={styles.HeaderType3}>
                            {translate({id: 'user.end', message: 'End'})}
                          </div>

                          <div className={styles.HeaderType4}>
                            {translate({id: 'user.status', message: 'Status'})}
                          </div>

                          <div className={styles.HeaderType4}>
                            {translate({id: 'user.action', message: 'Action'})}
                          </div>
                        </div>
                        
                        <div className={styles.Tdiv}>
                          &nbsp;
                        </div>

                        <div className={ToProjectAllStat}>
                          {profileData && (profileData.projectlist ? (profileData.projectlist.map((project_info, index) => (
                            <div key={`project-all-${index}`} className={styles.ContentWrap}> 
                              <div className={styles.ContentType1}>
                                {project_info.ProjectName}
                              </div>
                              <div style={{width: "80% "}}>
                                {profileData.result && (project_info.Tasks.length > 0 ? (project_info.Tasks.map((task_info, index) => (
                                <div key={`task-all-${index}`}>
                                  <div style={{display: "flex", flexDirection: "row"}}>
                                    <div className={styles.ContentType2}>
                                      {task_info.TaskName}
                                    </div>
                                    <div className={styles.ContentType3}>
                                      {task_info.StartDate}
                                    </div>
                                    <div className={styles.ContentType3}>
                                      {task_info.EndDate}
                                    </div>
                                    <div className={styles.ContentType4}>
                                      {task_info.Status}
                                    </div>
                                    <div className={styles.DownloadType2} onClick={() => Delete(project_info.ProjectName, task_info.TaskName, profileData.token)}>
                                      {translate({id: 'user.delete', message: 'Delete'})}
                                    </div>
                                  </div>
                                </div>
                                ))) : (                  
                                <div style={{display: "flex", flexDirection: "row"}}>            
                                  <div className={styles.ContentType2}>
                                    {profileData.error}
                                  </div>
                                  <div className={styles.ContentType3}>
                                    {profileData.error}
                                  </div>
                                  <div className={styles.ContentType3}>
                                    {profileData.error}
                                  </div>
                                  <div className={styles.ContentType4}>
                                    {translate({id: 'user.noTask', message: 'No Task'})}
                                  </div>
                                  <div className={styles.DownloadType2} onClick={() => DeleteProject(project_info.ProjectName, profileData.token)}>
                                    {translate({id: 'user.delete', message: 'Delete'})}
                                  </div>
                                </div>
                                ))
                                }
                                </div>
                              </div>))) : (
                              <div className={styles.ContentWrap}> 
                                <div className={styles.ContentType1}>
                                  {profileData.error}
                                </div>
                              </div>
                            ))
                          } 

                        </div>

                        <div className={ToProjectQueueStat}> 
                          {profileData && (profileData.projectlist ? (profileData.projectlist.map((project_info, index) => 
                            {
                              const hasInQueueTask = project_info.Tasks && project_info.Tasks.some(task_info => task_info.Status === "in queue");
                            
                              return hasInQueueTask ? (
                              (
                                <div key={`project-queue-${index}`} className={styles.ContentWrap}> 
                                  <div className={styles.ContentType1}>
                                    {project_info.ProjectName}
                                  </div>
                                  <div style={{width: "80% "}}>
                                    {profileData.result && (project_info.Tasks ? (project_info.Tasks.map((task_info, index) => ((task_info.Status == "in queue") && (
                                      <div key={`task-queue-${index}`}>
                                        <div style={{display: "flex", flexDirection: "row"}}>
                                          <div className={styles.ContentType2}>
                                            {task_info.TaskName}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.StartDate}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.EndDate}
                                          </div>
                                          <div className={styles.ContentType4}>
                                            {task_info.Status}
                                          </div>
                                          <div className={styles.DownloadType2} onClick={() => Delete(project_info.ProjectName, task_info.TaskName, profileData.token)}>
                                            {translate({id: 'user.delete', message: 'Delete'})}
                                          </div>
                                        </div>
                                      </div>)))) : (                  
                                      <div>            
                                        <div className={styles.ContentType3}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                    </div>
                                    ))}
                                  </div>
                                </div>
                              )) : (<div></div>)
                            })) : (
                              <div className={styles.ContentWrap}> 
                                <div className={styles.ContentType1}>
                                  {profileData.error}
                                </div>
                              </div>
                            ))
                          } 
                        </div>

                        <div className={ToProjectIPStat}>                           
                          {profileData && (profileData.projectlist ? (profileData.projectlist.map((project_info, index) => 
                            {
                              const hasInQueueTask = project_info.Tasks && project_info.Tasks.some(task_info => task_info.Status === "running");
                            
                              return hasInQueueTask ? (
                              (
                                <div key={`project-running-${index}`} className={styles.ContentWrap}> 
                                  <div className={styles.ContentType1}>
                                    {project_info.ProjectName}
                                  </div>
                                  <div style={{width: "80% "}}>
                                    {profileData.result && (project_info.Tasks ? (project_info.Tasks.map((task_info, index) => ((task_info.Status == "running") && (
                                      <div key={`task-running-${index}`}>
                                        <div style={{display: "flex", flexDirection: "row"}}>
                                          <div className={styles.ContentType2}>
                                            {task_info.TaskName}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.StartDate}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.EndDate}
                                          </div>
                                          <div className={styles.ContentType4}>
                                            {task_info.Status}
                                          </div>
                                          <div className={styles.DownloadType2} onClick={() => Delete(project_info.ProjectName, task_info.TaskName, profileData.token)}>
                                            {translate({id: 'user.delete', message: 'Delete'})}
                                          </div>
                                        </div>
                                      </div>)))) : (                  
                                      <div>            
                                        <div className={styles.ContentType3}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                    </div>
                                    ))}
                                  </div>
                                </div>
                              )) : (<div></div>)
                            })) : (
                              <div className={styles.ContentWrap}> 
                                <div className={styles.ContentType1}>
                                  {profileData.error}
                                </div>
                              </div>
                            ))
                          } 
                        </div>

                        <div className={ToProjectFStat}>                           
                          {profileData && (profileData.projectlist ? (profileData.projectlist.map((project_info, index) => 
                            {
                              const hasInQueueTask = project_info.Tasks && project_info.Tasks.some(task_info => task_info.Status === "failed");
                            
                              return hasInQueueTask ? (
                              (
                                <div key={`project-failed-${index}`} className={styles.ContentWrap}> 
                                  <div className={styles.ContentType1}>
                                    {project_info.ProjectName}
                                  </div>
                                  <div style={{width: "80% "}}>
                                    {profileData.result && (project_info.Tasks ? (project_info.Tasks.map((task_info, index) => ((task_info.Status == "failed") && (
                                      <div key={`task-failed-${index}`}>
                                        <div style={{display: "flex", flexDirection: "row"}}>
                                          <div className={styles.ContentType2}>
                                            {task_info.TaskName}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.StartDate}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.EndDate}
                                          </div>
                                          <div className={styles.ContentType4}>
                                            {task_info.Status}
                                          </div>
                                          <div className={styles.DownloadType2} onClick={() => Delete(project_info.ProjectName, task_info.TaskName, profileData.token)}>
                                            {translate({id: 'user.delete', message: 'Delete'})}
                                          </div>
                                        </div>
                                      </div>)))) : (                  
                                      <div>            
                                        <div className={styles.ContentType3}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                    </div>
                                    ))}
                                  </div>
                                </div>
                              )) : (<div></div>)
                            })) : (
                              <div className={styles.ContentWrap}> 
                                <div className={styles.ContentType1}>
                                  {profileData.error}
                                </div>
                              </div>
                            ))
                          } 
                        </div>

                        <div className={ToProjectCompStat}>                           
                          {profileData && (profileData.projectlist ? (profileData.projectlist.map((project_info, index) => 
                            {
                              const hasInQueueTask = project_info.Tasks && project_info.Tasks.some(task_info => task_info.Status === "completed");
                            
                              return hasInQueueTask ? (
                              (
                                <div key={`project-completed-${index}`} className={styles.ContentWrap}> 
                                  <div className={styles.ContentType1}>
                                    {project_info.ProjectName}
                                  </div>
                                  <div style={{width: "80% "}}>
                                    {profileData.result && (project_info.Tasks ? (project_info.Tasks.map((task_info, index) => ((task_info.Status == "completed") && (
                                      <div key={`task-completed-${index}`}>
                                        <div style={{display: "flex", flexDirection: "row"}}>
                                          <div className={styles.ContentType2}>
                                            {task_info.TaskName}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.StartDate}
                                          </div>
                                          <div className={styles.ContentType3}>
                                            {task_info.EndDate}
                                          </div>
                                          <div className={styles.ContentType4}>
                                            {task_info.Status}
                                          </div>
                                          <div className={styles.DownloadType2} onClick={() => Delete(project_info.ProjectName, task_info.TaskName, profileData.token)}>
                                            {translate({id: 'user.delete', message: 'Delete'})}
                                          </div>
                                        </div>
                                      </div>)))) : (                  
                                      <div>            
                                        <div className={styles.ContentType3}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                        <div className={styles.ContentType2}>
                                          {profileData.error}
                                        </div>
                                    </div>
                                    ))}
                                  </div>
                                </div>
                              )) : (<div></div>)
                            })) : (
                              <div className={styles.ContentWrap}> 
                                <div className={styles.ContentType1}>
                                  {profileData.error}
                                </div>
                              </div>
                            ))
                          } 
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div> 
  );
}

export default function UserPage1() {
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

