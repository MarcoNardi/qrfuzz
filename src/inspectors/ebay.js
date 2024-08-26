class Inspector {
    app_name = "ebay";
    app_package = "com.ebay.mobile";
    app_activity = "com.ebay.mobile.home.impl.main.MainActivity";

    async goToScan(driver) {

        let close = await driver.findElement("id", 'com.ebay.mobile:id/identity_app_onboarding_screen_close');        
        await driver.elementClick(close.ELEMENT);

        let search= await driver.findElement("id", "com.ebay.mobile:id/search_box");
        await driver.elementClick(search.ELEMENT);
        let scan = await driver.findElement("id", 'com.ebay.mobile:id/button_image_search');        
        await driver.elementClick(scan.ELEMENT);
    }

    async getResultView(driver) {
        return await driver.findElement("xpath", "/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout");
    }

    async goBackToScan(driver) {
        // the screenshot will automatically close this
        //let search = await driver.findElement("xpath", '//android.widget.TextView[@content-desc="Search Keyword Search on eBay"]');        
        //await driver.elementClick(search.ELEMENT);

        let scan = await driver.findElement("id", 'com.ebay.mobile:id/search_image_btn');        
        await driver.elementClick(scan.ELEMENT);

    }
}

exports.Inspector = Inspector;