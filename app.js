var express = require('express');
const { Octokit } = require('@octokit/rest');
var app = express();
const helpers = require('./helpers/helper');
const stripBom = require('strip-bom');
require('dotenv').config();

const octokit = new Octokit({
  auth: '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',
});
var arguments = process.argv;
console.log(arguments);
app.get('/', async (req, res) => {
  try {
    const gitRepoObjForQbCLi = {
      owner: 'akhilesh168',
      repo: 'react-gh-pages',
      path: 'qblcli.json',
      ref: 'master',
    };

    const response = await helpers.getFileContent(gitRepoObjForQbCLi);

    let decoded = Buffer.from(response, 'base64').toString();

    const existingQbCliConfigs = JSON.parse(decoded);
    console.log(existingQbCliConfigs);
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
    //get file contents from the build folder
    try {
      //gets an array of file contents.  Each item in the array ahs filename, and filecontent, and conditionally a "isIndexFile" boolean.
      var arrayOfFileContents = await Promise.all(
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

      //add the appopriate extension prefix to each file depending on whether it is dev/prod deployment.  IF an index file has been listed, set the indexFileName below.
      var indexFileName = null;
      arrayOfFileContents = arrayOfFileContents.map((item) => {
        const [fileName, fileContents, isIndexFile] = item;
        if (isIndexFile) {
          indexFileName = fileName;
        }
        return [`${prefix}${fileName}`, fileContents];
      });
    } catch (err) {
      console.error(
        'Please check your qbcli.json in the root of your project. Make sure you have mapped the correct path to all of the files you are trying to deploy.  Also check all filenames match what is in those directories and make sure those files have content (this tool will not deploy blank files - add a comment if you would like to deploy without code).'
      );
      return;
    }

    res.status(200).json(decoded);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

module.exports = app;
