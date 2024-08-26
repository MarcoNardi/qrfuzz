const _wdio = import("webdriverio");
import * as loader from "./loader";
import * as qr_writer from "./qr_code";
import {
  dicts_iterator,
  list_dicts,
  saveState,
  DictsIterStatus,
} from "./dictionary.js";
import { log, saveLogcat, saveScreenshot } from "./logger";
import sleep from "./sleep";
import { get_generator } from "./generators";

import { exec as _exec } from "child_process";
import { promisify } from "util";
const exec = async (s: string) =>
  await promisify(_exec)(s).then(({ stdout, stderr }) => {
    if (stdout !== "") {
      console.log(stdout);
    }
    if (stderr !== "") {
      console.error(stderr);
    }
  });

loader.checkArguments();
const app_id = loader.app_name();
const _appIns = loader.getAppInspector();

const _opts = _appIns.then((appIns) => ({
  path: "/wd/hub",
  port: loader.fuzz_port(), // 4723,
  capabilities: {
    platformName: "Android",
    "appium:appPackage": appIns.app_package,
    "appium:appActivity": appIns.app_activity,
    "appium:automationName": "UiAutomator2",
    "appium:autoGrantPermissions": "true",
    // "appium:noReset": "true"
  },
  logLevel: "warn",
}));

const tmp_qr = "/tmp/qr_code.png";

// Main loop
// Curious developer, start from here :)

const main = async () => {
  const data_path = loader.data_path();
  const wdio_timeout = loader.wdio_timeout();

  let driver = await startDriver(wdio_timeout);
  const appIns = await _appIns;

  const { spawn } = require("child_process");

  const ls = spawn("acv", ["activate", appIns.app_package]);  
  ls.stdout.on("data", (data: string) => {
    console.log(`stdout: ${data}`);
  });

  ls.stderr.on("data", (data: string) => {
      console.log(`stderr: ${data}`);
  });

  ls.on('error', (error: { message: any; }) => {
      console.log(`error: ${error.message}`);
  });

  ls.on("close", (code: any) => {
      console.log(`child process exited with code ${code}`);
  });

  await goToAppScanPage(driver);

  const generator = get_generator(app_id);

  // by default fuzz all
  const files = (await list_dicts()).map((dict) => dict.fullname);
  const qr_iter = await dicts_iterator(app_id, files);

  // Perform QR Checking
  let qr_payload: Uint8Array | null;
  let qr_status: DictsIterStatus;
  let coverage_count=0;
  
  const fs = require("fs")
  let qrcodecountsfile=`qrcodecounts${appIns.app_package}.txt`
  try {
    const data = fs.readFileSync(qrcodecountsfile, 'utf8');
    coverage_count = parseInt(data, 10); 
    console.log(`Read value ${coverage_count} from ${qrcodecountsfile}`);
  } catch (error) {
    console.error(`Error reading file ${qrcodecountsfile}`, error);
    coverage_count = 1; // default value
}
  while ((([qr_payload, qr_status] = qr_iter()), qr_payload != null)) {
    console.log(`coverage number: ${coverage_count}`)
    if(coverage_count%30==0){  //every 30 qr codes we compute the coverage    
      const command = 'acv';
      const args = ['snap', appIns.app_package];

      const child = spawn(command, args);

      child.stdout.on('data', (data: Buffer) => {
        //console.log(`Output: ${data.toString()}`);
      });
    
      child.stderr.on('data', (data: Buffer) => { 
        console.error(`Error: ${data.toString()}`);
      });
    
      child.on('close', (code: number) => { 
        console.log(`Process exited with code ${code}`);
        if(code==0){
          console.log("pulled data now starting coverage")
          const { spawn } = require('child_process');
          
          const getTimestamp = () => {
            return new Date().toISOString(); 
        };
          
          const command = 'acv';
          const args = ['cover-pickles', appIns.app_package];
          const logFile = `outputacv${appIns.app_package}.log`; // Name of the log file

          // Open a writable stream to the log file
          const logStream = fs.createWriteStream(logFile, { flags: 'a' }); 

          const child = spawn(command, args);

          child.stdout.on('data', (data: Buffer) => {
              logStream.write(`Output ${getTimestamp()}: ${data.toString()}\n`);
          });

          child.stderr.on('data', (data: Buffer) => {
              logStream.write(`Error ${getTimestamp()}: ${data.toString()}\n`);
          });

          child.on('close', (code: number) => {
              logStream.write(`${getTimestamp()} Process exited with code ${code}\n`);
              logStream.end(); // Close the log file stream
              console.log(`Process completed. Check ${logFile} for details.`);
          });
        }
      });
    }
    const dict = qr_status.files[qr_status.dict_idx];
    const line_idx = qr_status.line_idx;
    const name = `${dict}-${line_idx}`;

    await sleep(2000);
    const qr_content = generator(qr_payload);
    const OK = Symbol("ok");
    const qr_ok = await qr_writer
      .write(qr_content, tmp_qr)
      .then(() => OK)
      .catch((e: Error) => e);
    if (qr_ok !== OK) {
      const msg = `[index.ts] Unable to generate QR Code: file: ${dict}, line: ${line_idx}\n${String(qr_ok)}`;
      console.log(msg);

      log(data_path, msg);
      continue;
    }

    await exec(`../util/stream ${tmp_qr}`);

    await sleep(3000);

    console.log(`> QR code under analysis: file: ${dict}, line: ${line_idx}`);

    driver = await checkAppRunningAndRestart(driver, wdio_timeout);
    
    // Hook to result view
    const result_view = await appIns.getResultView(driver);

    // Result view error check
    if (result_view?.error == "no such element") {
      const msg = `[index.ts] Unable to read QR Code: file: ${dict}, line: ${line_idx}`;
      console.log(msg);

      log(data_path, msg);
      await Promise.all([
        saveLogcat(appIns, data_path, name + ".log", driver),
        saveScreenshot(data_path, name + ".png", driver),
      ]);
    } else {
      //the qr code is successfully scanned so i update the coverage count variable
      coverage_count++;

      fs.writeFileSync(qrcodecountsfile, coverage_count.toString());
      console.log(`Saved value ${coverage_count} to ${qrcodecountsfile}`);
      // Await for the script before taking a screenshot
      await sleep(200);
      const msg = `[index.ts] Read QR Code: file: ${dict}, line: ${line_idx}`;
      console.log(msg);

      log(data_path, msg);
      await Promise.all([
        saveLogcat(appIns, data_path, name + ".log", driver),
        saveScreenshot(data_path, name + ".png", driver),
      ]);
    }

    await saveState(qr_status);

    try {
      await appIns.goBackToScan(driver);
    } catch (error) {
      driver = await startDriver(10000);
      await goToAppScanPage(driver);
    }
  }

  await driver.deleteSession();
};

// Start and set the config for the WebdriverIO
async function startDriver(timeout = 10000) {
  const wdio = await _wdio;
  const opts = await _opts;
  //@ts-expect-error ...
  const driver = await wdio.remote(opts);
  // Wait before crashing if not finding an element
  await driver.setTimeout({ implicit: timeout });
  return driver;
}

async function goToAppScanPage(driver: WebdriverIO.Browser) {
  const appIns = await _appIns;
  const data_path = loader.data_path();
  try {
    await appIns.goToScan(driver);
  } catch (error) {
    const msg = `[index.ts] Unable to go to the scan page (error: ${error as string})`;
    console.log(msg);
    log(data_path, msg);
    await goToAppScanPage(driver);
  }
}

async function checkAppRunningAndRestart(
  driver: WebdriverIO.Browser,
  timeout = 10000
) {
  const appState = await driver.queryAppState((await _appIns).app_package);

  if (appState != 4) {
    // 4= running in foreground
    console.log(
      "[QRCodeFuzzer] Process unexpectedly closed. Trying to restore..."
    );
    driver = await startDriver(timeout);
    await goToAppScanPage(driver);
  }
  return driver;
}

main().catch(console.error);
