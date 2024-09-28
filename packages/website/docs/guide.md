---
sidebar_position: 2
---

# Guide

Castmill is a large system that can be used to tackle most scenarios that can arise in the digital signage world. This guide will help you understand the main concepts and how to use the system.

There are several concepts that are important to understand in order to use Castmill effectively. These are:
- [Networks](networks.md)
- [Organizations](organizations.md)
- [Users](users.md)
- [Teams](teams.md)
- [Devices](devices.md)
- [Content](content.md)
- [Widgets](widgets.md)
- [Schedules](schedules.md)

These concepts are the building blocks of the Castmill system. They are used to organize and manage the different parts of the system.

## Networks

Networks are the top level organization of the system. Networks are associated to domains, and are essentially isolated silos of data. Each network can have its own organizations, users, devices, content and schedules. And no data can be shared between networks.

In most cases you will only need one network, and then use organizations to segment your users and data. But if you must have multiple isolated groups of data, then you can create multiple networks.

The network is the main entry point for the system as a regular user, when you login from the dashboard you will be taken to the network that is associated to the domain you are using. For example, if I am running the system on example.com, I could define different networks for different clients associated to different subdomains, like client1.example.com and client2.example.com.

Network management can only be done in the admin tool, and this tool is only accessible to users with the admin role. In fact the admin tool is a very powerful tool that can be used to manage all the data in the system, but it is not meant to be used by regular users, as that is the function of the dashboard.

### How to create a network

To create a network you must login into the admin tool and go to the Networks section. There you will find a button to create a new network. You must fill in the name and domain of the network. The domain is important as it will be used to associate the network to the domain of the dashboard.


## Running a local S3 server

To run a local S3 server you can use the [minio](https://min.io/) server. You can download the server from the website and run it with the following command:

```bash
mkdir -p ~/minio/data

docker run \
   -p 9000:9000 \
   -p 9001:9001 \
   --user $(id -u):$(id -g) \
   --name minio1 \
   -e "MINIO_ROOT_USER=ROOTUSER" \
   -e "MINIO_ROOT_PASSWORD=CHANGEME123" \
   -v ~/minio/data:/data \
   quay.io/minio/minio server /data --console-address ":9001"
```

This will start the minio server on port 9000 and the console on port 9001. You can access the console by going to http://localhost:9001. The default username is `ROOTUSER` and the password is `CHANGEME123`. You can change the password in the console.

