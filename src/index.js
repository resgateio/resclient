/**
 * Client implementation of the RES-Client Protocol.
 */

import ResClient, { isResError } from './class/ResClient.js';
import ResCollection from './class/ResCollection.js';
import ResModel from './class/ResModel.js';

export { ResCollection, ResModel, isResError };
export default ResClient;
