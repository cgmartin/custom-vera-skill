# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### New features
- Added ability to override the Alexa display category from a custom Vera device variable:
    ```
    # Under Devices -> {Device} -> Advanced -> New Service (tab)
    New service: urn:cgmartin-com:serviceId:SmartHomeSkill1
    New variable: DisplayCategory
    New value: LIGHT
    ```

## [v1.0.1] - 2017-11-12
### Internal refactor
- Refactored handlers to use a promise API.
- No new features or fixes.

## v1.0.0 - 2017-11-08
### Initial release
- See README.md for setup instructions.

[Unreleased]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.0.1...HEAD
[v1.0.1]: https://github.com/cgmartin/custom-vera-skill/compare/v1.0.0...v1.0.1
