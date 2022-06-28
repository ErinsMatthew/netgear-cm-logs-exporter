# Netgear Cable Modem Logs Exporter

This application will export event logs from a Netgear Cable Modem.  I've run this on my
Netgear CM1000 that uses firmware V6.01.07.  I ran it using Node.js v16.15.1.

## Getting Started

Once you've downloaded the code from this repo, you can then install the necessary modules and run the application as such.  Noce that you can either place the modem password in the [config/default.json](config/default.json) file, or in the environment variable named `MODEM_PASSWORD`.  See all the environment variables you can use in [config/custom-environment-variables.json](config/custom-environment-variables.json).

```sh
$ npm install

$ MODEM_PASSWORD=$uperSe@ret node ./app.js
```

## Appreciation

This module is heavily based on the reverse-engineering found at https://gist.github.com/DexterHaslem/d0365dd4cbbcceac22a002fa981beaae

Thank you, @DexterHaslem!