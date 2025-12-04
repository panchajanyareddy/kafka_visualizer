#!/bin/bash

# Script to extract unique metric names from Prometheus metrics output
# Usage:
#   ./get_metrics.sh http://localhost:9090/metrics
#   ./get_metrics.sh metrics.txt
#   curl -s http://localhost:9090/metrics | ./get_metrics.sh

process_metrics() {
    # 1. grep -v '^#': Remove comments
    # 2. grep -v '^$': Remove empty lines
    # 3. awk -F'{': Split by '{' to separate metric name from labels
    # 4. awk '{print $1}': Print first field (metric name)
    # 5. sort -u: Sort and remove duplicates
    grep -v '^#' | \
    grep -v '^$' | \
    awk -F'{' '{print $1}' | \
    awk '{print $1}' | \
    sort -u
}

if [ -n "$1" ]; then
    if [[ "$1" =~ ^http ]]; then
        # Input is a URL
        curl -s "$1" | process_metrics
    elif [ -f "$1" ]; then
        # Input is a file
        cat "$1" | process_metrics
    else
        echo "Error: Argument must be a valid URL or file path." >&2
        exit 1
    fi
else
    # No argument provided, read from stdin
    process_metrics
fi
