# vera-custom-skill

UNOFFICIAL custom skill for Vera™ Controllers. Compatible with [Smart Home Skill API v3](https://developer.amazon.com/docs/smarthome/smart-home-skill-migration-guide.html).

This Open Source Software (OSS) project is not affiliated with, endorsed, or sponsored by Vera Control, Ltd. in any way. The author is merely a hobbyist who owns a VeraPlus controller and wishes to share this implementation for Home Skill v3 support with other DIYers while the official Vera Control skill is updated (as of 8 Nov 2017). Use at your own risk.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**NOTE**: Do not submit this Smart Home skill for certification. This skill is intended for personal use only and should not be released on the Alexa Skills Marketplace:

- Only a single Vera user is supported. Unless you want the world controlling your home devices, multi-user authentication and other implementation changes would be required for a public skill.
- Vera Scenes are not currently being checked for [secure devices](https://developer.amazon.com/docs/smarthome/provide-scenes-in-a-smart-home-skill.html#allowed-devices) and would not pass the Skill approval process. Do not put Door Locks or other sensitive devices that could be misued from Alexa within your Vera Scenes. Again, use at your own risk.

## What is Included

Most Smart Home v3 features have been implemented (dimmers, switches, locks, thermostats, scenes), but there are few items missing support:

- [Cameras](https://developer.amazon.com/docs/smarthome/build-smart-home-camera-skills.html): If you have a camera integrated with Vera and wouldn't mind sharing your user_data and sdata information for the device, I'd be happy to look into adding support. I do not currently have any cameras to test with.
- [Colored Lights](https://developer.amazon.com/docs/smarthome/build-smart-home-skills-for-lights.html): Same deal... I do not have any colored lights to test with - please share your user_data and sdata device info.
- [Entertainment Devices](https://developer.amazon.com/docs/smarthome/build-smart-home-skills-for-entertainment-devices.html): I'm not sure how possible or interested I'd be adding support for this. I know there is a Harmony Hub Vera plugin that might be able to be integrated, but it wasn't stable for me. Regarding speakers, I don't know offhand if that works through Vera.


## Getting Started

These instructions will get a copy of the project up and running on your local machine for development and testing purposes. See [AWS Deployment Notes](#aws-deployment-notes) for how to deploy the project into AWS and to activate your own personal custom Alexa Smart Home skill.

### Prerequisites

1. Linux or Mac OS: [Or use a Linux Virtual Machine](https://www.storagecraft.com/blog/the-dead-simple-guide-to-installing-a-linux-virtual-machine-on-windows/)
2. Node.js v6.10+: [Installation instructions](https://nodejs.org/en/download/package-manager/)
3. AWS CLI: [Installation instructions](http://docs.aws.amazon.com/cli/latest/userguide/installing.html)

### Local Setup

1. Clone this repo:

    ```
    $ git clone https://github.com/cgmartin/vera-custom-skill.git
    $ cd vera-custom-skill
    ```

2. Install Node.js dependencies:

    ```
    $ npm install
    ```

3. Configure environment variables for your personal Vera controller:

    ```
    $ cp .env-EXAMPLE .env
    # Edit the .env file and change the values
    # ** Do NOT the configure the S3 Cache the first time through
    ```

    | ENV Name | Value Type | Description |
    |---|---|---|
    | `VERA_USER_ID` | string | Your Vera user login ID |
    | `VERA_PASSWORD` | string | Your Vera login password |
    | `VERA_PASSWORD_HASH` | string | A pre-computed SHA1 Password Hash to be used instead of `VERA_PASSWORD` (see: `./hashpassword.sh`) |
    | `VERA_CONTROLLER_ID` | comma separated numbers | Controller IDs to include (default: includes all controllers) |
    | `VERA_SCENES_INCLUDE` | comma separated numbers | Scene IDs to include |
    | `VERA_SCENES_EXCLUDE` | comma separated numbers | Scene IDs to exclude (will not be used if `VERA_SCENES_INCLUDE` is set) |
    | `VERA_DEVICES_INCLUDE` | comma separated numbers | Scene IDs to include |
    | `VERA_DEVICES_EXCLUDE` | comma separated numbers | Scene IDs to exclude (will not be used if `VERA_DEVICES_INCLUDE` is set) |
    | `VERA_CACHE_S3_BUCKET` | string | AWS S3 Bucket name |
    | `VERA_CACHE_S3_KEY` | string | AWS S3 cache file path (default: `custom_vera_skill/vera_cache.json`) |
    | `VERA_CACHE_S3_REGION` | string | AWS S3 Bucket region (default: `us-east-1`) |
    | `VERA_CACHE_TTL` | number (ms) | Default TTL for cache expiration (default: `84600000` 23.5 hours) |

4. Run a local discovery test:

    ```
    $ npm run test-discovery
    ```

    Successful output:

    ```
    ...
    {
            "event": {
                    "header": {
                            "namespace": "Alexa.Discovery",
                            "name": "Discover.Response",
                            "payloadVersion": "3",
                            "messageId": "1a625913-9c49-48fa-9c2c-7eba5523cb2e"
                    }
    ...
    info: Lambda successfully executed in 5974ms.
    ```

    * If you see a `Discover.Response` event header and the `"Lambda successfully executed"` message in the output, all is well. Move onto the next instructions to set up the S3 cache and to deploy into AWS.

    * If you see an `ErrorResponse` event header, or a `Lambda failed` message, something went wrong. Double check your environment variable settings. If still having issues and out of ideas, submit a github issue for more help.


## AWS Deployment Notes

### S3 Cache

Setting up a S3 bucket to cache Vera auth sessions and device information will help speed up typical requests from ~3 seconds to ~1 second (based on my personal tests). If interested in using a different storage system, look at  `./lib/s3-vera-cache.js` for an example to base your implementation on.

Without a cache, the Lambda function will need to authenticate, retrieve controller information, and create new sessions with the Vera servers for every request. This requires 6 HTTP requests at a minimum to be sent to the Vera Servers before sending other actions to your Controller. The Alexa application UI prefers quick responses and may display a temporary "This device is unresponsive" message when things aren't returned within ~2 seconds.

**NOTE:** The cache will be cleared upon any Discovery events. If you experience any issues with normal usage, you can try rediscovering your devices from the Alexa app to clear the cache.

The next sections assume you have the AWS CLI installed and [configured with your AWS credentials](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

#### S3 Setup

1. Create a new S3 bucket: (replace `<bucket_name>` with a name like `my-vera-skill-dev`)

    ```
    $ aws s3api create-bucket --region us-east-1 --bucket <bucket_name>
    ```


2. Configure the environment variables to use your newly created bucket:

    ```
    # Edit file: .env
    # Uncomment the line and replace with your bucket name
    VERA_CACHE_S3_BUCKET=<bucket_name>
    ```

3. Test locally with the new S3 setting:

    ```
    $ npm run test-discovery | head -20
    ```

    Successful output:
    ```
    ...
    [DEBUG] Vera Request: authenticate(vera-us-oem-autha.mios.com)
    [DEBUG] S3VeraCache putObject success
    ...
    ```

    * If you see `"[DEBUG] S3VeraCache putObject success"` messages, the S3 configuration is correct.

    * If you see `"[WARNING] S3VeraCache getObject failed"` messages, double check your S3 bucket name in the configuration and AWS credentials.

### Alexa Skill Setup

The Amazon Alexa Developer docs have [step-by-step instructions](https://developer.amazon.com/docs/smarthome/steps-to-build-a-smart-home-skill.html) for setting up a Smart Home Skill. Follow these and then continue with the instructions below.

### Lambda Setup

1. Create an IAM policy file `/tmp/custom-vera-skill-s3-access-policy.json` for the Lambda to access the S3 Bucket.

    Add the following content (replace `<bucket_name>` with your bucket name):

    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "Stmt1509934467926",
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject"
                ],
                "Effect": "Allow",
                "Resource": [
                    "arn:aws:s3:::<bucket_name>/custom_vera_skill/*"
                ]
            }
        ]
    }
    ```

2. Create the IAM policy in AWS:

    ```
    $ aws iam create-policy --policy-name CustomVeraSkillS3AccessPolicy --policy-document file:///tmp/custom-vera-skill-s3-access-policy.json
    ```

    Make note of the policy `Arn:` returned in the output - you will need this in the next step:

    ```
    {
        "Policy": {
            ...
            "Arn": "arn:aws:iam::<your_aws_account_num>:policy/CustomVeraSkillS3AccessPolicy"
        }
    }
    ```

3. Assign this policy to the Lambda role that was created earlier:

    ```
    # Use the policy ARN from step 2:
    $ aws iam attach-role-policy --policy-arn arn:aws:iam::<your_aws_account_num>:policy/CustomVeraSkillS3AccessPolicy --role-name CustomVeraSkillLambdaRole
    ```

4. Run the publish script to upload this project:

    ```
    $ ./publish.sh <lambda_name>
    ```

    If you make any changes to the code locally, you can push it to AWS by re-running this `./publish.sh` script.

4. Configure the Lambda environment variables:

    ```
    $ aws lambda update-function-configuration --region us-east-1 --function-name customVeraSkill --environment "Variables={VERA_USER_ID=<vera_username>,VERA_PASSWORD=<vera_password>,VERA_CACHE_S3_BUCKET=<bucket_name>}"
    ```

5. Test that the Lambda runs successfully

    Create a file `/tmp/discovery-event.json` with these contents:
    ```
    {
      "directive": {
        "header": {
          "namespace": "Alexa.Discovery",
          "name": "Discover",
          "payloadVersion": "3",
          "messageId": "1bd5d003-31b9-476f-ad03-71d471922820"
        },
        "payload": {
          "scope": {
            "type": "BearerToken",
            "token": "some-access-token"
          }
        }
      }
    }
    ```

    Invoke the Lambda in AWS:
    ```
    $ aws lambda invoke --invocation-type RequestResponse --region us-east-1 --function-name CustomVeraSkill --payload file:///tmp/discovery-event.json /tmp/lambda-exec-output.txt
    ```

    Successful output:
    ```
    {
        "StatusCode": 200
    }
    ```


### Account Linking Setup

[Account linking information](https://developer.amazon.com/docs/smarthome/authenticate-an-alexa-user-account-linking.html#provide-account-linking-info) is required for the Smart Home skill to work. [*Login with Amazon*](http://login.amazon.com/) is the easiest way to enable this.

[Follow these steps](https://developer.amazon.com/blogs/post/tx3cx1etrzz2npc/alexa-account-linking-5-steps-to-seamlessly-link-your-alexa-skill-with-login-wit) to link your Custom Vera Skill with *Login with Amazon*.

You can use the following URL for a privacy policy link in Step 1: <https://raw.githubusercontent.com/cgmartin/custom-vera-skill/master/lwa/privacy-policy.html>

## License

[MIT License](./LICENSE.txt)

Vera™ is a registered trademark of [Vera Control, Ltd](http://getvera.com/).
