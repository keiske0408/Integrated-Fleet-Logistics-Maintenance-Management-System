import { Can } from '@casl/react';
import { AppAbility } from '../../src/auth/abilities';

export { Can };
export type AppCanProps = Parameters<typeof Can<AppAbility>>[0];
