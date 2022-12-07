let express = require('express');
let app = express();
const helpers = require('./helpers/helper');
const stripBom = require('strip-bom');
const {
  generateAllAPICallPromises,
  addUpdateDbPage,
} = require('./helpers/helper');
require('dotenv').config();

let arguments = process.argv;
console.log('Script started reading arguments', arguments);
app.get('/', async (req, res) => {
  try {
    console.log('Script started');
    const OWNER = arguments[2].split('=')[1];
    const REPO_NAME = arguments[3].split('=')[1];
    const APP_TOKEN = arguments[4].split('=')[1];
    const USER_TOKEN = arguments[5].split('=')[1];

    const gitRepoObjForQbCLi = {
      owner: OWNER,
      repo: REPO_NAME,
      path: 'qblcli.json',
      ref: 'master',
    };

    if (APP_TOKEN === '' || USER_TOKEN === '') {
      console.error('Please provide the apptoken/usertoken to continued');
      res.status(500).json({
        message: 'Please provide the apptoken/usertoken to continued',
      });
      // process.exit(0);
    }
    console.log('Script getFileContent started');
    const response = await helpers.getFileContent(gitRepoObjForQbCLi);
    console.log('Script getFileContent completed');
    let decoded = Buffer.from(response, 'base64').toString();

    const existingQbCliConfigs = JSON.parse(decoded);
    const gitRepoObjForDeployDirObj = {
      owner: existingQbCliConfigs.owner,
      repo: existingQbCliConfigs.repo,
      path: existingQbCliConfigs.deployPath,
      ref: existingQbCliConfigs.ref,
    };
    let deploymentType = null;
    if (existingQbCliConfigs.isProd) {
      deploymentType = 'prod';
    } else if (existingQbCliConfigs.isDev) {
      deploymentType = 'dev';
    } else if (existingQbCliConfigs.isFeat) {
      deploymentType = 'feat';
    }
    //get prefix for files
    const prefix = helpers.prefixGenerator(
      {
        customPrefix: existingQbCliConfigs.devPrefix,
        customPrefixProduction: existingQbCliConfigs.prodPrefix,
      },
      deploymentType,
      existingQbCliConfigs.repositoryId
    );
    //get file contents from the build
    try {
      //gets an array of file contents.  Each item in the array ahs filename, and filecontent, and conditionally a "isIndexFile" boolean.
      console.log('Script api getAllFileContents started');
      let arrayOfFileContents = await Promise.all(
        helpers.getAllFileContents(
          existingQbCliConfigs.filesConf,
          prefix,
          gitRepoObjForDeployDirObj,
          stripBom
        )
      );

      if (!arrayOfFileContents || arrayOfFileContents.length < 1) {
        console.error(
          'Please check your qbcli.json in the root of your project. Make sure you have mapped the correct path to all of the files you are trying to deploy.  Also check all filenames match what is in those directories - and that all files have content (this tool will not deploy blank files - add a comment in the file if you would like to deploy without code).'
        );
        return;
      }
      console.log('Script api getAllFileContents completed');
      //add the appopriate extension prefix to each file depending on whether it is dev/prod deployment.  IF an index file has been listed, set the indexFileName below.
      let indexFileName = null;
      arrayOfFileContents = arrayOfFileContents.map((item) => {
        const [fileName, fileContents, isIndexFile] = item;
        if (isIndexFile) {
          indexFileName = fileName;
        }
        return [`${prefix}${fileName}`, fileContents];
      });
      const configs = {
        dbid: existingQbCliConfigs.dbid,
        realm: existingQbCliConfigs.realm,
        apptoken: APP_TOKEN,
        usertoken: USER_TOKEN,
      };
      console.log('Script api addUpdateDbPage started');
      const response = await Promise.all(
        generateAllAPICallPromises(
          configs,
          arrayOfFileContents,
          addUpdateDbPage
        )
      );
      console.log('Script api addUpdateDbPage completed');
      process.exit(0);
    } catch (err) {
      console.error(
        'Please check your qbcli.json in the root of your project. Make sure you have mapped the correct path to all of the files you are trying to deploy.  Also check all filenames match what is in those directories and make sure those files have content (this tool will not deploy blank files - add a comment if you would like to deploy without code).'
      );
      return;
    }

    /* res.status(200).json(decoded); */
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

module.exports = app;
