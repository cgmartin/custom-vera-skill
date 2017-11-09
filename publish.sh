#!/bin/bash
# Publishes the script to AWS Lambda
set -e
command -v aws >/dev/null 2>&1 || { echo >&2 "I require AWS CLI but it's not installed (see: http://docs.aws.amazon.com/cli/latest/userguide/installing.html).  Aborting."; exit 1; }

fnName=${1:-customVeraSkill}
zipfile=/tmp/custom-vera-skill.zip

# Clean up from previous runs
rm $zipfile 2>/dev/null || true

# NOTE: If any npm modules are added, make sure to include the ./node_modules dir to the zip file
zip $zipfile ./index.js ./lib ./handlers -r -X
aws lambda update-function-code --region us-east-1 --function-name ${fnName} --zip-file fileb://$zipfile
