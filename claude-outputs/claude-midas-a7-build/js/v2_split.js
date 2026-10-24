// One vault row per event.
return $('V1 Vault events').first().json.events.map(e => ({ json: e }));
