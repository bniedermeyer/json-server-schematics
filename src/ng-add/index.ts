import { Schema } from './schema.model';
import {
  Rule,
  SchematicContext,
  Tree,
  chain
} from '@angular-devkit/schematics';
import {
  NodePackageInstallTask,
  RunSchematicTask
} from '@angular-devkit/schematics/tasks';
import {
  addPackageJsonDependency,
  NodeDependency,
  NodeDependencyType
} from 'schematics-utilities';

const DEPS: NodeDependency[] = [
  { type: NodeDependencyType.Dev, version: '0.14.2', name: 'json-server' }
];

export default function(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    return chain([addDependencies(), performAdditionalSetup(options)]);
  };
}

function addDependencies(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    DEPS.forEach((dependency) => {
      addPackageJsonDependency(tree, dependency);
      context.logger.info(`Added dependency ${dependency.name}`);
    });
    return tree;
  };
}

function performAdditionalSetup(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const installTask = context.addTask(new NodePackageInstallTask());
    context.addTask(new RunSchematicTask('ng-add-setup', options), [
      installTask
    ]);
    return tree;
  };
}
