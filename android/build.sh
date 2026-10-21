#!/usr/bin/env bash
# Local build helper.
#
# The JDK, Android SDK and Gradle live outside the repository, so every
# shell needs these three variables set before Gradle will run. This script
# points them at the local toolchain and then runs whatever Gradle task was
# asked for.
set -euo pipefail

TOOLS_DIR="${TOOLS_DIR:-$HOME/Documents/tools}"

export JAVA_HOME="$TOOLS_DIR/jdk-17.0.20.1+1"
export ANDROID_HOME="$TOOLS_DIR/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle}"

export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TASK="${1:-assembleDebug}"
shift || true

exec "$TOOLS_DIR/gradle-8.11.1/bin/gradle" -p "$ANDROID_DIR" "$TASK" "$@"
