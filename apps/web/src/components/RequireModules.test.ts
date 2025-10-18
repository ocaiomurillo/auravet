import { hasAllRequiredModules } from './RequireModules';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const modules = ['services:read', 'owners:read', 'animals:read'];
const allGranted = new Set(modules);
const missingAnimals = new Set(['services:read', 'owners:read']);

const allGrantedResult = hasAllRequiredModules(modules, (module) => allGranted.has(module));
assert(allGrantedResult, 'Expected access when all modules are granted');
console.log('✓ allows access when every required module is granted');

const missingAnimalsResult = hasAllRequiredModules(modules, (module) => missingAnimals.has(module));
assert(!missingAnimalsResult, 'Expected denial when a module is missing');
console.log('✓ denies access when any required module is missing');
