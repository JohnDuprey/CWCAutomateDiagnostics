import json
import os
import subprocess

def system_call(command):
    p = subprocess.Popen([command], stdout=subprocess.PIPE, shell=True)
    return p.stdout.read()

# Read state file for info
with open("/usr/local/ltechagent/state","r") as read_file:
	data = json.load(read_file)

# Get last contact date
lc = data["last_contact"]
last_contact = "{0}/{1}/{2} {3}:{4}:{5}".format(lc["day_of_month"],lc["month"],lc["year"],lc["hour"],lc["min"],lc["sec"])

# Check services
if os.name == 'posix':
	if system_call("launchctl list | grep com.labtechsoftware.LTSvc") != "":
		svc_ltsvc = { "Status": "Running", "User": "com.labtechsoftware.LTSvc", "Start Mode": "Auto"}
	else:
		svc_ltsvc = { "Status": "Stopped", "User": "com.labtechsoftware.LTSvc", "Start Mode": "Auto"}
else:
	print("Linux")


diag_result = { 
	'server_addr': data["last_good_server_url"], 
	'lastcontact': last_contact,
	'update': data["version"],
	'version': data["version"],
	'id': data['computer_id'],
	'online': data["is_signed_in"],
	'svc_ltservice': svc_ltsvc
}

print("!---BEGIN JSON---!")
print(json.dumps(diag_result))
