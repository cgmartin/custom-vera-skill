# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Bug fixes
- Fixed: Colored Bulb Device adjust temperature - incorrect error handling when device status is missing

### New features
- Forbids discovery and usage of Scenes that include [insecure devices](https://developer.amazon.com/docs/smarthome/provide-scenes-in-a-smart-home-skill.html#scene-discovery-and-allowed-devices) [#5](https://github.com/cgmartin/custom-vera-skill/pull/5).

### Changes
- Session cache will not be cleared during Discovery in this release. Discovery events occur more frequently than expected - cache helps reduce the lambda execution time for this heavy operation. If this becomes problematic, may need to clear the cache in certain error scenarios.


## [v1.1.0] - 2017-11-19
### Bug fixes
- Fixed: Alexa gives an error when adjusting a dimmer out of range [#3](https://github.com/cgmartin/custom-vera-skill/issues/3)

### New features
- Added ability to override the Alexa display category from a custom Vera device variable [#2](https://github.com/cgmartin/custom-vera-skill/pull/2):
    ```
    # Under Devices -> {Device} -> Advanced -> New Service (tab)
    New service: urn:cgmartin-com:serviceId:SmartHomeSkill1
    New variable: DisplayCategory
    New value: LIGHT
    ```
- Color RGBW bulb and BrightnessController support [#4](https://github.com/cgmartin/custom-vera-skill/pull/4). Tested with the [Zipato RGBW LED bulb](http://getvera.com/portfolio-posts/zipato-rgbw-led-bulb/).


## [v1.0.1] - 2017-11-12
### Internal refactor
- Refactored handlers to use a promise API [#1](https://github.com/cgmartin/custom-vera-skill/pull/1).
- No new features or fixes.


## v1.0.0 - 2017-11-08
### Initial release
- See README.md for setup instructions.

[Unreleased]: https://github.com/cgmartin/custom-vera-skill/compare/v1.1.0...HEAD
[v1.1.0]: https://github.com/cgmartin/custom-vera-skill/compare/v1.0.1...v1.1.0
[v1.0.1]: https://github.com/cgmartin/custom-vera-skill/compare/v1.0.0...v1.0.1
