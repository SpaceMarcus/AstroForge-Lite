# AstroForge Lite

[Open AstroForge Lite](https://spacemarcus.github.io/AstroForge-Lite/)

Version 2.12 restores the existing thrust, Isp, mass-flow, geometry, feed, pump and shaft calculations. Core performance uses the existing interpolated CEA equilibrium tables and retains their original ideal-predesign limitations.

**Only regenerative cooling is a representative demonstration.** Six interactive plots display temperatures in K, pressure in bar, heat flux in MW/m² and heat-transfer coefficients in kW/(m²·K), prominently marked DEMO. These profiles are not calibrated or validated. Their heat pickup and pressure loss feed into the original system calculation; dependent feed results are marked accordingly. Cooling does not change the existing fixed-reactant CEA performance model.

The original cooling-channel implementation and its coolant/transport tables remain private. This repository includes a separate illustrative model, public UI, the existing non-cooling models and the core thermochemical/constant feed data needed to run them. No backend or payment is required. Projects stay in the browser.

AstroForge is in development, planned from 2027.
