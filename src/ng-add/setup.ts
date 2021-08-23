import { Schema } from './schema.model';
import {
  Rule,
  Tree,
  SchematicContext,
  apply,
  move,
  mergeWith,
  url,
  MergeStrategy,
  chain,
  FileEntry,
  forEach
} from '@angular-devkit/schematics';
import {
  getWorkspace,
  getProjectFromWorkspace,
  readIntoSourceFile
} from 'schematics-utilities';
import path = require('path');

export default function(options: Schema): Rule {
  return () => {
    return chain([
      setupProxy(options),
      setupJsonServer(options),
      addPackageJsonScript(options)
    ]);
  };
}

function setupProxy(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const workspace = getWorkspace(tree);
    const project = getProjectFromWorkspace(workspace, options.project);
    const proxyPath = `${project.root}/proxy.conf.json`;
    if (tree.exists(proxyPath)) {
      context.logger.info('proxy exists!');

      const sourceFile = readIntoSourceFile(tree, proxyPath);
      const sourceJson = JSON.parse(sourceFile.getText());
      const newProxyConf = {
        ...sourceJson,
        '/api': {
          target: 'http://localhost:3000/',
          secure: false
        }
      };
      tree.overwrite('proxy.conf.json', JSON.stringify(newProxyConf, null, 2));
      context.logger.log(
        'info',
        '✅ Added proxy config for json-server to existing proxy config'
      );
      return tree;
    } else {
      const source = apply(url('./files/proxy/'), [move(project.root)]);
      const rule = mergeWith(source, MergeStrategy.Default);

      context.logger.log('info', '✅ Created json-server proxy configuration');
      return rule(tree, context);
    }
  };
}

function setupJsonServer(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    // normally we would want to move files to the project space but these files can exist outside of
    // the project and the user should be able choose where in the workspace they should be created
    // e.g a user wants to run json-server for multiple Angular apps in the same workspace
    const jsonServerPath = options.path;
    if (tree.exists(options.path)) {
      return tree;
    } else {
      const source = apply(url('./files/json-server/'), [
        move(jsonServerPath),
        forEach((fileEntry: FileEntry) => {
          if (tree.exists(fileEntry.path)) {
            tree.overwrite(fileEntry.path, fileEntry.content);
          }
          return fileEntry;
        })
      ]);
      const rule = mergeWith(source, MergeStrategy.Overwrite);

      context.logger.log('info', `✅ Added json-server`);
      return rule(tree, context);
    }
  };
}

function addPackageJsonScript(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const workspace = getWorkspace(tree);
    const project = getProjectFromWorkspace(workspace, options.project);
    const proxyPath = `${project.root}proxy.conf.json`;
    const jsonServerScript = path.normalize(
      `json-server ${options.path}/db.json --routes ${options.path}/routes.json`
    );
    const serveScript = `npm run json-server & ng serve ${
      options.project
    } --proxy-config ${proxyPath}`;
    try {
      const packageJsonFile = tree.read(`package.json`);
      if (packageJsonFile) {
        const packageJsonFileObject = JSON.parse(packageJsonFile.toString());
        const updatedPackageJsonFileObject = {
          ...packageJsonFileObject,
          scripts: {
            ...packageJsonFileObject.scripts,
            'json-server': jsonServerScript,
            'serve:json-server': serveScript
          }
        };
        tree.overwrite(
          'package.json',
          JSON.stringify(updatedPackageJsonFileObject, null, 2)
        );
      }
    } catch (e) {
      context.logger.log('error', 'Unable to add script to package.json', e);
    }
    context.logger.log('info', '✅ Added scripts to package.json');
    return tree;
  };
}
