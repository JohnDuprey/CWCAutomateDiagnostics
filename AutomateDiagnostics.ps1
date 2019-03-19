# WMI Service check and start/auto
Function serviceCheck($service){
    $svc_info = Get-WmiObject win32_service | where-object {$_.name -eq $service}
    if ($null -ne $svc_info.State) { @{'Status' = $svc_info.State; 'Start Mode' = $svc_info.StartMode; 'User' = $svc_info.StartName} }
    else {@{'Status' = 'Not Detected'; 'Start Mode' = ""; 'User' = ""}}
}

# Check PS Version
Function Get-PSVersion {
	if (test-path variable:psversiontable) {$psversiontable.psversion} else {[version]"1.0.0.0"}
}

#PS 2.0 JSON Conversion
function Escape-JSONString($str){
	if ($null -eq $str) {return ""}
	$str = $str.ToString().Replace('"','\"').Replace('\','\\').Replace("`n",'\n').Replace("`r",'\r').Replace("`t",'\t')
	return $str;
}

function extractHostname($url) {
    if ($url -eq "") {
        $false
    }
    else {
	    ([System.Uri]"$url").Authority
    }
}

# Author: Joakim Borger Svendsen, 2017. http://www.json.org
# Svendsen Tech. Public domain licensed code.

# Take care of special characters in JSON (see json.org), such as newlines, backslashes
# carriage returns and tabs.
# '\\(?!["/bfnrt]|u[0-9a-f]{4})'
function FormatString {
    param(
        [String] $String)
    # removed: #-replace '/', '\/' `
    # This is returned 
    $String -replace '\\', '\\' -replace '\n', '\n' `
        -replace '\u0008', '\b' -replace '\u000C', '\f' -replace '\r', '\r' `
        -replace '\t', '\t' -replace '"', '\"'
}

# Meant to be used as the "end value". Adding coercion of strings that match numerical formats
# supported by JSON as an optional, non-default feature (could actually be useful and save a lot of
# calculated properties with casts before passing..).
# If it's a number (or the parameter -CoerceNumberStrings is passed and it 
# can be "coerced" into one), it'll be returned as a string containing the number.
# If it's not a number, it'll be surrounded by double quotes as is the JSON requirement.
function GetNumberOrString {
    param(
        $InputObject)
    if ($InputObject -is [System.Byte] -or $InputObject -is [System.Int32] -or `
        ($env:PROCESSOR_ARCHITECTURE -imatch '^(?:amd64|ia64)$' -and $InputObject -is [System.Int64]) -or `
        $InputObject -is [System.Decimal] -or $InputObject -is [System.Double] -or `
        $InputObject -is [System.Single] -or $InputObject -is [long] -or `
        ($Script:CoerceNumberStrings -and $InputObject -match $Script:NumberRegex)) {
        Write-Verbose -Message "Got a number as end value."
        "$InputObject"
    }
    else {
        Write-Verbose -Message "Got a string as end value."
        """$(FormatString -String $InputObject)"""
    }
}

function ConvertToJsonInternal {
    param(
        $InputObject, # no type for a reason
        [Int32] $WhiteSpacePad = 0)
    [String] $Json = ""
    $Keys = @()
    Write-Verbose -Message "WhiteSpacePad: $WhiteSpacePad."
    if ($null -eq $InputObject) {
        Write-Verbose -Message "Got 'null' in `$InputObject in inner function"
        $null
    }
    elseif ($InputObject -is [Bool] -and $InputObject -eq $true) {
        Write-Verbose -Message "Got 'true' in `$InputObject in inner function"
        $true
    }
    elseif ($InputObject -is [Bool] -and $InputObject -eq $false) {
        Write-Verbose -Message "Got 'false' in `$InputObject in inner function"
        $false
    }
    elseif ($InputObject -is [HashTable]) {
        $Keys = @($InputObject.Keys)
        Write-Verbose -Message "Input object is a hash table (keys: $($Keys -join ', '))."
    }
    elseif ($InputObject.GetType().FullName -eq "System.Management.Automation.PSCustomObject") {
        $Keys = @(Get-Member -InputObject $InputObject -MemberType NoteProperty |
            Select-Object -ExpandProperty Name)
        Write-Verbose -Message "Input object is a custom PowerShell object (properties: $($Keys -join ', '))."
    }
    elseif ($InputObject.GetType().Name -match '\[\]|Array') {
        Write-Verbose -Message "Input object appears to be of a collection/array type."
        Write-Verbose -Message "Building JSON for array input object."
        #$Json += " " * ((4 * ($WhiteSpacePad / 4)) + 4) + "[`n" + (($InputObject | ForEach-Object {
        $Json += "[`n" + (($InputObject | ForEach-Object {
            if ($null -eq $_) {
                Write-Verbose -Message "Got null inside array."
                " " * ((4 * ($WhiteSpacePad / 4)) + 4) + "null"
            }
            elseif ($_ -is [Bool] -and $_ -eq $true) {
                Write-Verbose -Message "Got 'true' inside array."
                " " * ((4 * ($WhiteSpacePad / 4)) + 4) + "true"
            }
            elseif ($_ -is [Bool] -and $_ -eq $false) {
                Write-Verbose -Message "Got 'false' inside array."
                " " * ((4 * ($WhiteSpacePad / 4)) + 4) + "false"
            }
            elseif ($_ -is [HashTable] -or $_.GetType().FullName -eq "System.Management.Automation.PSCustomObject" -or $_.GetType().Name -match '\[\]|Array') {
                Write-Verbose -Message "Found array, hash table or custom PowerShell object inside array."
                " " * ((4 * ($WhiteSpacePad / 4)) + 4) + (ConvertToJsonInternal -InputObject $_ -WhiteSpacePad ($WhiteSpacePad + 4)) -replace '\s*,\s*$' #-replace '\ {4}]', ']'
            }
            else {
                Write-Verbose -Message "Got a number or string inside array."
                $TempJsonString = GetNumberOrString -InputObject $_
                " " * ((4 * ($WhiteSpacePad / 4)) + 4) + $TempJsonString
            }
        #}) -join ",`n") + "`n],`n"
        }) -join ",`n") + "`n$(" " * (4 * ($WhiteSpacePad / 4)))],`n"
    }
    else {
        Write-Verbose -Message "Input object is a single element (treated as string/number)."
        GetNumberOrString -InputObject $InputObject
    }
    if ($Keys.Count) {
        Write-Verbose -Message "Building JSON for hash table or custom PowerShell object."
        $Json += "{`n"
        foreach ($Key in $Keys) {
            # -is [PSCustomObject]) { # this was buggy with calculated properties, the value was thought to be PSCustomObject
            if ($null -eq $InputObject.$Key) {
                Write-Verbose -Message "Got null as `$InputObject.`$Key in inner hash or PS object."
                $Json += " " * ((4 * ($WhiteSpacePad / 4)) + 4) + """$Key"": null,`n"
            }
            elseif ($InputObject.$Key -is [Bool] -and $InputObject.$Key -eq $true) {
                Write-Verbose -Message "Got 'true' in `$InputObject.`$Key in inner hash or PS object."
                $Json += " " * ((4 * ($WhiteSpacePad / 4)) + 4) + """$Key"": true,`n"            }
            elseif ($InputObject.$Key -is [Bool] -and $InputObject.$Key -eq $false) {
                Write-Verbose -Message "Got 'false' in `$InputObject.`$Key in inner hash or PS object."
                $Json += " " * ((4 * ($WhiteSpacePad / 4)) + 4) + """$Key"": false,`n"
            }
            elseif ($InputObject.$Key -is [HashTable] -or $InputObject.$Key.GetType().FullName -eq "System.Management.Automation.PSCustomObject") {
                Write-Verbose -Message "Input object's value for key '$Key' is a hash table or custom PowerShell object."
                $Json += " " * ($WhiteSpacePad + 4) + """$Key"":`n$(" " * ($WhiteSpacePad + 4))"
                $Json += ConvertToJsonInternal -InputObject $InputObject.$Key -WhiteSpacePad ($WhiteSpacePad + 4)
            }
            elseif ($InputObject.$Key.GetType().Name -match '\[\]|Array') {
                Write-Verbose -Message "Input object's value for key '$Key' has a type that appears to be a collection/array."
                Write-Verbose -Message "Building JSON for ${Key}'s array value."
                $Json += " " * ($WhiteSpacePad + 4) + """$Key"":`n$(" " * ((4 * ($WhiteSpacePad / 4)) + 4))[`n" + (($InputObject.$Key | ForEach-Object {
                    #Write-Verbose "Type inside array inside array/hash/PSObject: $($_.GetType().FullName)"
                    if ($null -eq $_) {
                        Write-Verbose -Message "Got null inside array inside inside array."
                        " " * ((4 * ($WhiteSpacePad / 4)) + 8) + "null"
                    }
                    elseif ($_ -is [Bool] -and $_ -eq $true) {
                        Write-Verbose -Message "Got 'true' inside array inside inside array."
                        " " * ((4 * ($WhiteSpacePad / 4)) + 8) + "true"
                    }
                    elseif ($_ -is [Bool] -and $_ -eq $false) {
                        Write-Verbose -Message "Got 'false' inside array inside inside array."
                        " " * ((4 * ($WhiteSpacePad / 4)) + 8) + "false"
                    }
                    elseif ($_ -is [HashTable] -or $_.GetType().FullName -eq "System.Management.Automation.PSCustomObject" `
                        -or $_.GetType().Name -match '\[\]|Array') {
                        Write-Verbose -Message "Found array, hash table or custom PowerShell object inside inside array."
                        " " * ((4 * ($WhiteSpacePad / 4)) + 8) + (ConvertToJsonInternal -InputObject $_ -WhiteSpacePad ($WhiteSpacePad + 8)) -replace '\s*,\s*$'
                    }
                    else {
                        Write-Verbose -Message "Got a string or number inside inside array."
                        $TempJsonString = GetNumberOrString -InputObject $_
                        " " * ((4 * ($WhiteSpacePad / 4)) + 8) + $TempJsonString
                    }
                }) -join ",`n") + "`n$(" " * (4 * ($WhiteSpacePad / 4) + 4 ))],`n"
            }
            else {
                Write-Verbose -Message "Got a string inside inside hashtable or PSObject."
                # '\\(?!["/bfnrt]|u[0-9a-f]{4})'
                $TempJsonString = GetNumberOrString -InputObject $InputObject.$Key
                $Json += " " * ((4 * ($WhiteSpacePad / 4)) + 4) + """$Key"": $TempJsonString,`n"
            }
        }
        $Json = $Json -replace '\s*,$' # remove trailing comma that'll break syntax
        $Json += "`n" + " " * $WhiteSpacePad + "},`n"
    }
    $Json
}

function ConvertTo-STJson {
    [CmdletBinding()]
    #[OutputType([Void], [Bool], [String])]
    param(
        [AllowNull()]
        [Parameter(Mandatory=$true,
                   ValueFromPipeline=$true,
                   ValueFromPipelineByPropertyName=$true)]
        $InputObject,
        [Switch] $Compress,
        [Switch] $CoerceNumberStrings = $false)
    begin{
        $JsonOutput = ""
        $Collection = @()
        # Not optimal, but the easiest now.
        [Bool] $Script:CoerceNumberStrings = $CoerceNumberStrings
        [String] $Script:NumberRegex = '^-?\d+(?:(?:\.\d+)?(?:e[+\-]?\d+)?)?$'
        #$Script:NumberAndValueRegex = '^-?\d+(?:(?:\.\d+)?(?:e[+\-]?\d+)?)?$|^(?:true|false|null)$'
    }
    process {
        # Hacking on pipeline support ...
        if ($_) {
            Write-Verbose -Message "Adding object to `$Collection. Type of object: $($_.GetType().FullName)."
            $Collection += $_
        }
    }
    end {
        if ($Collection.Count) {
            Write-Verbose -Message "Collection count: $($Collection.Count), type of first object: $($Collection[0].GetType().FullName)."
            $JsonOutput = ConvertToJsonInternal -InputObject ($Collection | ForEach-Object { $_ })
        }
        else {
            $JsonOutput = ConvertToJsonInternal -InputObject $InputObject
        }
        if ($null -eq $JsonOutput) {
            Write-Verbose -Message "Returning `$null."
            return $null # becomes an empty string :/
        }
        elseif ($JsonOutput -is [Bool] -and $JsonOutput -eq $true) {
            Write-Verbose -Message "Returning `$true."
            [Bool] $true # doesn't preserve bool type :/ but works for comparisons against $true
        }
        elseif ($JsonOutput-is [Bool] -and $JsonOutput -eq $false) {
            Write-Verbose -Message "Returning `$false."
            [Bool] $false # doesn't preserve bool type :/ but works for comparisons against $false
        }
        elseif ($Compress) {
            Write-Verbose -Message "Compress specified."
            (
                ($JsonOutput -split "\n" | Where-Object { $_ -match '\S' }) -join "`n" `
                    -replace '^\s*|\s*,\s*$' -replace '\ *\]\ *$', ']'
            ) -replace ( # these next lines compress ...
                '(?m)^\s*("(?:\\"|[^"])+"): ((?:"(?:\\"|[^"])+")|(?:null|true|false|(?:' + `
                    $Script:NumberRegex.Trim('^$') + `
                    ')))\s*(?<Comma>,)?\s*$'), "`${1}:`${2}`${Comma}`n" `
              -replace '(?m)^\s*|\s*\z|[\r\n]+'
        }
        else {
            ($JsonOutput -split "\n" | Where-Object { $_ -match '\S' }) -join "`n" `
                -replace '^\s*|\s*,\s*$' -replace '\ *\]\ *$', ']'
        }
    }
}


Function Start-AutomateDiagnostics {
	Param(
        $ltposh = "http://bit.ly/LTPoSh",
        $automate_server = ""
    )
    
    # Force checkin
    sc.exe control ltservice 136 | Out-Null

    # Get powershell version
	$psver = Get-PSVersion
    
    Try { 
		(new-object Net.WebClient).DownloadString($ltposh) | Invoke-Expression 
		$ltsvcinfo = Get-Command -ListImported -Name Get-LTServiceInfo		
		$ltposh_loaded = $true
	} 
	Catch {
		$_.Exception.Message
		$ltposh_loaded = $false
	}
    If ($ltposh_loaded -eq $false -and $ltposh -ne "http://bit.ly/LTPoSh") {
        Write-Output "LTPosh failed to load, failing back to bit.ly link"
        $ltposh = "http://bit.ly/LTPoSh"
		Try { 
			(new-object Net.WebClient).DownloadString($ltposh) | Invoke-Expression 
			$ltsvcinfo = Get-Command -ListImported -Name Get-LTServiceInfo		
			$ltposh_loaded = $true
		} 
		Catch {
			$_.Exception.Message
			$ltposh_loaded = $false
		}
    }

	# Check services
	$ltservice_check = serviceCheck('LTService')
    $ltsvcmon_check = serviceCheck('LTSVCMon')

    # Get reg keys in case LTPosh fails
    $ltsvc_path_exists = Test-Path -Path (Join-Path $env:windir "\ltsvc")
    $locationid = Try { (Get-ItemProperty -Path hklm:\software\labtech\service -ErrorAction Stop).locationid } Catch { $null }
    $clientid = Try { (Get-ItemProperty -Path hklm:\software\labtech\service -ErrorAction Stop).clientid } Catch { $null }
    $id = Try { (Get-ItemProperty -Path hklm:\software\labtech\service -ErrorAction Stop).id } Catch { $null }
    $version = Try { (Get-ItemProperty -Path hklm:\software\labtech\service -ErrorAction Stop).version } Catch { $null }
    $server = Try { ((Get-ItemProperty -Path hklm:\software\labtech\service -ErrorAction Stop)."Server Address") } Catch { $null }

    if ($ltposh_loaded) {
        # Get ltservice info
        Try {
            $info = Get-LTServiceInfo

            # Get checkin / heartbeat times to DateTime
	        $lastsuccess = Get-Date $info.LastSuccessStatus
	        $lasthbsent = Get-Date $info.HeartbeatLastSent
	        $lasthbrcv = Get-Date $info.HeartbeatLastReceived

            # Check online and heartbeat statuses
            $online_threshold = (Get-Date).AddMinutes(-5)
            $heartbeat_threshold = (Get-Date).AddMinutes(-5)
            
            # Split server list
            $servers = ($info.'Server Address').Split('|')
            $online = $lastsuccess -ge $online_threshold
            $heartbeat_rcv = $lasthbrcv -ge $heartbeat_threshold 
            $heartbeat_snd = $lasthbsent -ge $heartbeat_threshold
            $heartbeat = $heartbeat_rcv -or $heartbeat_snd
            $heartbeat_status = $info.HeartbeatLastSent

            
            # If services are stopped, use Restart-LTService to get them working again
            If ($ltservice_check.Status -eq "Stopped" -or $ltsvcmon_check -eq "Stopped" -or !($heartbeat) -or !($online)) {
                Start-Sleep -Seconds 60
                Try { Restart-LTService -Confirm:$false } Catch {}
                sc.exe control ltservice 136 | Out-Null
                Start-Sleep -Seconds 60
                $info = Get-LTServiceInfo
                $ltservice_check = serviceCheck('LTService')
                $ltsvcmon_check = serviceCheck('LTSVCMon')
                # Get checkin / heartbeat times to DateTime
                $lastsuccess = Get-Date $info.LastSuccessStatus
                $lasthbsent = Get-Date $info.HeartbeatLastSent
                $lasthbrcv = Get-Date $info.HeartbeatLastReceived
                $online = $lastsuccess -ge $online_threshold
                $heartbeat_rcv = $lasthbrcv -ge $heartbeat_threshold 
                $heartbeat_snd = $lasthbsent -ge $heartbeat_threshold
                $heartbeat = $heartbeat_rcv -or $heartbeat_snd
                $heartbeat_status = $info.HeartbeatLastSent
            }
            Try {
                # Check for persistent TCP connection
                if ($psver -ge [version]"3.0.0.0" -and $heartbeat -eq $false) { # Check network sockets for established connection from ltsvc to server
                    $socket = Get-Process -processname "ltsvc" | Foreach-Object { $process = $_.ID; Get-NetTCPConnection | Where-Object {$_.State -eq "Established" -and $_.RemotePort -eq 443 -and $_.OwningProcess -eq $process}}
                    if ($socket.State -eq 'Established') {
                        $heartbeat = $true
                        $heartbeat_status = "Socket Established"
                    }
                }
            } Catch {}

            # Get server list
            $server_test = $false
            foreach ($server in $servers) {
                $hostname = extractHostname($server)
                
                if (!($hostname) -or $hostname -eq "" -or $null -eq $hostname) {
                    continue
                }
                else {
                    Try {
                        $compare_test = if (($hostname -eq $automate_server -and $automate_server -ne "") -or $automate_server -eq "") { $true } else { $false }
                        $conn_test = Test-Connection $hostname
                        $ver_test = (new-object Net.WebClient).DownloadString("$($server)/labtech/agent.aspx")
                        $target_version = $ver_test.Split('|')[6]
                        if ($conn_test -and $target_version -ne "" -and $compare_test) {
                            $server_test = $true
                            $server_msg = "$server passed all checks"
                            break
                        }
                    }
                    Catch {
                        continue
                    }
                }
            }
            if ($server_test -eq $false -and $servers.Count -eq 0) {
                $server_msg = "No automate servers detected"
            }
            elseif ($server_test -eq $false -and $servers.Count -gt 0) {
                $server_msg = "Error"
                if (!($compare_test)) {
                    $server_msg = $server_msg + " | Server address not matched"
                }
                if (!($conn_test)) {
                    $server_msg = $server_msg + " | Ping failure"
                }
                if ($target_version -eq "") {
                    $server_msg = $server_msg + " | Version check fail"
                }
            }

            # Check updates
            $current_version = $info.Version
            if ($target_version -eq $info.Version) {
                $update_text = "Version {0} - Latest" -f $info.Version
            }
            else {
                taskkill /im ltsvc.exe /f
                taskkill /im ltsvcmon.exe /f
                taskkill /im lttray.exe /f
                Try {
                    Update-LTService -WarningVariable updatewarn
                    Start-Sleep -Seconds 60
                    Try { Restart-LTService -Confirm:$false } Catch {}
                    sc.exe control ltservice 136 | Out-Null
                    Start-Sleep -Seconds 300
                    
                    $info = Get-LTServiceInfo
                    
                    if ([version]$info.Version -gt [version]$current_version) {
                        $update_text = 'Updated from {1} to {0}' -f $info.Version,$current_version
                    }
                    else {
                        $update_text = 'Error updating to {0}, still on {1}' -f $target_version,$info.Version
                    }
                }
                Catch {
                    $update_text = "Error: Update-LTService failed to run"
                }

            }
            # Collect diagnostic data into hashtable
            $diag = @{
                'id' = $info.id
                'version' = $info.Version
                'server_addr' = $server_msg
                'server_match' = $compare_test
                'online' = $online
                'heartbeat' = $heartbeat
                'update' = $update_text
                'lastcontact'  = $info.LastSuccessStatus
                'heartbeat_sent' = $heartbeat_status
                'heartbeat_rcv' = $info.HeartbeatLastReceived
                'svc_ltservice' = $ltservice_check
                'svc_ltsvcmon' = $ltsvcmon_check
                'ltposh_loaded' = $ltposh_loaded
                'clientid' = $info.ClientID
                'locationid' = $info.LocationID
                'ltsvc_path_exists' = $ltsvc_path_exists
            }
        }
        Catch { # LTPosh loaded, issue with agent
            $_.Exception.Message
            $repair = if (!($ltsvc_path_exists) -or $ltsvcmon_check.Status -eq "Not Detected" -or $ltservice_check.Status -eq "Not Detected" -or $null -eq $id) { "Reinstall" } else { "Restart" }
            if ($null -eq $version -or $ltsvc_path_exists -eq $false) { $version = "Agent error" }
            $diag = @{
                'id' = $id
                'svc_ltservice' = $ltservice_check
                'svc_ltsvcmon' = $ltsvcmon_check
                'ltposh_loaded' = $ltposh_loaded
                'server_addr' = $server
                'version' = $version
                'ltsvc_path_exists' = $ltsvc_path_exists
                'locationid' = $locationid
                'clientid' = $clientid
                'repair' = $repair
            }
        }
    }
    else { # LTPosh Failure, show basic settings
        $diag = @{
            'id' = $id
            'ltsvc_path_exists' = $ltsvc_path_exists
            'server_addr' = $server
            'locationid' = $locationid
            'clientid' = $clientid
            'svc_ltservice' = $ltservice_check
            'svc_ltsvcmon' = $ltsvcmon_check
            'ltposh_loaded' = $ltposh_loaded
            'version' = $version
        }
    }
	Write-Output "!---BEGIN JSON---!"

	# Output diagnostic data in JSON format - ps2.0 compatible
	if ($psver -ge [version]"3.0.0.0") {
		$diag | ConvertTo-Json -depth 2
	}
	else {
		$diag | ConvertTo-STJson
	}
}
