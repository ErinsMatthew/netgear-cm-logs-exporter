#!/bin/bash


BASE_DIR=/root/netgear-cm-logs-exporter

LOGS_DIR=$BASE_DIR/logs
DB_FILE=$BASE_DIR/events.db
DB_TABLE=logs
PROCESSED_DIR=$LOGS_DIR/processed


for file in $LOGS_DIR/*.json; do
    [ -e "$file" ] || continue

    sqlite-utils insert "$DB_FILE" "$DB_TABLE" "$file"

    mv "$file" "$PROCESSED_DIR"
done
