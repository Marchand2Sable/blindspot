import '@fontsource-variable/inter';
import './styles.css';
import { GameEngine } from './engine/GameEngine';
import { buildLabel } from './buildinfo';

new GameEngine();

console.info(`BLINDSPOT ${buildLabel()}`);
