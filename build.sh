#!/bin/bash



# Adapted from:
#
#  - [How can I handle command-line options and arguments in my script easily? - BashFAQ/035 - Greg's Wiki](http://mywiki.wooledge.org/BashFAQ/035)

die() {
    printf '%s\n' "$1" >&2
    exit 1
}

# Initialize all the option variables.
# This ensures we are not contaminated by variables from the environment.
should_publish=false

while :; do
    case $1 in
        --publish)
            should_publish=true
            ;;
        --)                     # End of all options
            shift
            break
            ;;
        -?*)
            message=$(printf 'ERROR: Unknown option: %s\n' "$1")
            die "$message"
            ;;
        *)                      # Default case: No more options, so break out of the loop.
            break
    esac

    shift
done



Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99.0
export DEBUG=electron-installer-snap:snapcraft
sleep 5

yarn install --force
yarn run production

if [[ "$should_publish" = true ]]; then
    yarn run publish
fi
