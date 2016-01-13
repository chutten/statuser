<!-- DO NOT EDIT - AUTOMATICALLY GENERATED FROM: ./README.md.template -->

#Statuser
Statuser tracks user status in Firefox. You can get it here:
https://chutten.github.io/statuser/dist/

The current version is 0.0.11.

* If the user is considered active, it will take the shape of a red square.
* If the user is considered inactive, it will take the shape of a blue circle.
* If there is a toplevel navigation load happening, it will spin.
* If there has been a Gecko-main event delay longer than the specified threshold (see below), the badge counter will increment and change colour.

Click the Statuser button to access settings:

* **Count thread hangs**: choose this option to count the number of times the main thread stopped for too long.
    * Changing this value will clear the count.
* **Count event loop lags**: choose this option to count the number of times the event loop takes too long.
    * Changing this value will clear the count.
* **Minimum hang threshold**: the minimum number of milliseconds before a hang/lag is added to the count. Hangs/lags shorter than this are ignored.
    * Note that this value is rounded up to the nearest histogram bucket. That means the actual threshold may be somewhat higher.
* **Clear count**: reset the badge counter to 0.

Development
-----------

To build the extension, run `jpm xpi`. To build an XPI for distribution, simply run `bash build.sh`. Specify the version number in `package.json`, and the build script will insert it everywhere else where necessary.

Firefox addons [need to be signed](https://wiki.mozilla.org/Add-ons/Extension_Signing) before they can be properly installed. Authors of [Statuser on AMO](https://addons.mozilla.org/en-US/developers/addon/statuser) can sign the Statuser XPI file as follows:

1. Generate credentials at the [Developer Hub](https://addons.mozilla.org/en-US/developers/addon/api/key/). The JWT issuer is the API key, while the JWT secret is the API secret.
2. Run `jpm sign --api-key=API_KEY_GOES_HERE --api-secret=API_SECRET_GOES_HERE --xpi dist/statuser-*.xpi`.
3. Wait for validation to complete - the signed XPI will be downloaded to the working directory. This can sometimes take a while.
