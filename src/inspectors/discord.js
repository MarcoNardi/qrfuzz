const credentials = require("./credentials");

class Inspector {
    app_name = "discord";
    app_package = "com.discord";
    app_activity = "com.discord.main.MainActivity";

    async goToScan(driver) {
        const el1 = await driver.$("accessibility id:Settings, pollo_2269, ");
        await el1.click();
        
        let scan = await driver.findElement("xpath", '//android.widget.TextView[@text="Scan QR Code"]');
        await driver.elementClick(scan.ELEMENT);  
        

        
    }

    async getResultView(driver) {
        await driver.pause(1000);
    	return  await driver.findElement("xpath", '//android.widget.TextView[@text="Scan QR Code"]');
    }
    
    async goBackToScan(driver) {
        await driver.back()
    
        const el1 = await driver.$("accessibility id:Settings, pollo_2269, ");
        await el1.click();
        
        
    	let scan = await driver.findElement("xpath", '//android.widget.TextView[@text="Scan QR Code"]');
        await driver.elementClick(scan.ELEMENT);   
    }

}

exports.Inspector = Inspector;
