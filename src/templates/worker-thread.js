import process from 'socket:process'
import { isMainThread, workerData, parentPort } from 'socket:worker_threads'

// get the data that was initially passed into the worker
const data = new TextDecoder().decode(workerData.sampleData)


// Write some data to stdout which will be observed by the parent of the worker
process.stdout.write('hello world from worker')
