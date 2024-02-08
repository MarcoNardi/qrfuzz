const _wdio = import("webdriverio");
import * as loader from "./loader";
import * as qr_writer from "./qr_code";
import dicts_iterator, { DictsIterStatus, list_dicts } from "./dictionary.js";
import { log, saveLogcat, saveScreenshot } from "./logger";
import sleep from "./sleep";
import { exec } from "child_process";

loader.checkArguments();
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
}));

const tmp_qr = "/tmp/qr_code.png";

// Main loop
// Curious developer, start from here :)

const main = async () => {
  const data_path = loader.data_path();
  const wdio_timeout = loader.wdio_timeout();

  let driver = await startDriver(wdio_timeout);
  const appIns = await _appIns;

  await goToAppScanPage(driver);

  // by default fuzz all
  const files = (await list_dicts()).map((dict) => dict.fullname);
  const qr_iter = await dicts_iterator(files);

  // Perform QR Checking
  let qr_payload: Uint8Array | null;
  let qr_status: DictsIterStatus;
  while ((([qr_payload, qr_status] = qr_iter()), qr_payload != null)) {
    await sleep(1000);
    await qr_writer.write(Buffer.from(qr_payload), tmp_qr);
    exec(`../../../util/stream ${tmp_qr}`);
    await sleep(1000);

    const dict = qr_status.files[qr_status.dict_idx];
    const line_idx = qr_status.line_idx;
    const name = `${dict}-${line_idx}`;

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
        saveLogcat(appIns, data_path, name, driver),
        saveScreenshot(data_path, name, driver),
      ]);
    } else {
      // Await for the script before taking a screenshot
      await sleep(200);
      const msg = `[index.ts] Read QR Code: file: ${dict}, line: ${line_idx}`;
      console.log(msg);

      log(data_path, msg);
      await Promise.all([
        saveLogcat(appIns, data_path, name, driver),
        saveScreenshot(data_path, name, driver),
      ]);

      try {
        await appIns.goBackToScan(driver);
      } catch (error) {
        driver = await startDriver(10000);
        await goToAppScanPage(driver);
      }
    }
  }

  await driver.deleteSession();
};

//  TODO save iterator state to resume fuzzing later
// Get the JSON parameters of fuzzer.json
// function getJsonParams() {
//   let file = "start";
//   var n = fuzzer.size(loader.fuzz_path());
//   var start = loader.fuzz_start();
//   if (start > 0) {
//     console.log(`[QRCodeFuzzer] Resuming QR codes from <${start}> of <${n}>`);
//   }
//   console.log(`[QRCodeFuzzer] Scan page reached! ${start}`);
//   return { start, n, file };
// }

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
    console.log(
      "[index.ts] Please place the App manually in the scan page; then press any key to continue..."
    );
    await keypress();
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

// Handler to detect CTRL+C to exit the program
const keypress = async () => {
  process.stdin.setRawMode(true);
  return new Promise<void>((resolve) =>
    process.stdin.once("data", (data) => {
      const byteArray = [...data];
      if (byteArray.length > 0 && byteArray[0] === 3) {
        console.log("[QRCodeFuzzer] Exit program");
        process.exit(1);
      }
      process.stdin.setRawMode(false);
      resolve();
    })
  );
};

main().catch(console.error);
