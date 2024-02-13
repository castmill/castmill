## Castmill Dashboard

This package provides a complete Dashboard for managing all the devices in a given network and/or organization,
the contents, the channels, etc. In short is the main interface for users to manage their digital signage.

# Development

A development server can be started with

```bash
yarn dev
```

however you will need the Castmill server running as well on localhost port 4000.

# Test

The tests are implemented with Vitest and are simply run with
```bash
yarn test
```

# Login

In order to login into the dashboard you must use passkeys. The first step is to signup providing a valid email address.
The server will send an email to the given address, however in development mode the email will instead be available on 
the "Swoosh" inbox web interface found here: http://localhost:4000/dev/mailbox

You will find a signup email there, just copy the provided verification link to a browser in order to complete the signup process.

