# source: https://raw.githubusercontent.com/noaht8um/CWCAutomateDiagnostics/master/AutomateDiagnostics.sh

# Exit if not macOS
if [ "$(uname)" != "Darwin" ]; then
    exit 1
fi

# Arcane way to parse JSON natively on Macs with AppleScript
# https://paulgalow.com/how-to-work-with-json-api-data-in-macos-shell-scripts
convertFromJson() {
    JSON="$1" osascript -l 'JavaScript' \
        -e 'const env = $.NSProcessInfo.processInfo.environment.objectForKey("JSON").js' \
        -e "JSON.parse(env).$2"
}

# Read state file for info
data=$(cat /usr/local/ltechagent/state)

status=$(launchctl list | grep com.labtechsoftware.LTSvc)
if [ -z "$status" ]; then
    launchctl stop com.labtechsoftware.LTSvc
    launchctl start com.labtechsoftware.LTSvc
    status=$(launchctl list | grep com.labtechsoftware.LTSvc)
    if [ -z "$status" ]; then
        statusName="Stopped"
    else
        statusName="Running"
    fi
else
    statusName="Running"
fi

old_version=$(convertFromJson "$data" 'version')

/usr/local/ltechagent/ltupdate

# Read state file for info
data=$(cat /usr/local/ltechagent/state)

new_version=$(convertFromJson "$data" 'version')
if [ "$old_version" != "$new_version" ]; then
    update="Updated from $old_version to $new_version"
else
    update="Already updated to $new_version"
fi

server_addr=$(convertFromJson "$data" 'last_good_server_url')
version=$(convertFromJson "$data" 'version')
id=$(convertFromJson "$data" 'computer_id')
clientid=$(convertFromJson "$data" 'client_id')
online=$(convertFromJson "$data" 'is_signed_in')

# Format lastcontact time
sec=$(printf "%02d\n" $(convertFromJson "$data" 'last_contact.sec'))
min=$(printf "%02d\n" $(convertFromJson "$data" 'last_contact.min'))
hour=$(convertFromJson "$data" 'last_contact.hour')
day_of_month=$(convertFromJson "$data" 'last_contact.day_of_month')
month=$(convertFromJson "$data" 'last_contact.month')
year=$(convertFromJson "$data" 'last_contact.year')
lastcontact=$(echo "$month/$day_of_month/$year $hour:$min:$sec")

# collect agent logs
lterrors=""
log_file="/usr/local/ltechagent/agent.log"

if [ -f "$log_file" ]; then
    lterrors_str=$(sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/\&apos;/g" "$log_file")
    lterrors=$(echo "$lterrors_str" | base64)
fi

json=$(
    cat <<EOF
{"svc_ltservice": {"Status": "$statusName", "User": "com.labtechsoftware.LTSvc", "Start Mode": "Auto"}, "version": "$version", "clientid": $clientid,"online": $online,"id": $id,"lterrors": "$lterrors", "update": "$update", "server_addr": "$server_addr", "lastcontact": "$lastcontact"}
EOF
)

printf "!---BEGIN JSON---! "
echo $json
