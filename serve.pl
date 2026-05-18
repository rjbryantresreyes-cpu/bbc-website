#!/usr/bin/perl
use strict;
use warnings;
use HTTP::Daemon;
use HTTP::Status;
use File::Basename;
use POSIX qw();

my $port = $ARGV[0] || 8765;
my $root = $ARGV[1] || dirname(__FILE__);

my $d = HTTP::Daemon->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    ReuseAddr => 1,
) or die "Cannot start server on port $port: $!";

print "Serving $root at http://127.0.0.1:$port/\n";
$| = 1;

while (my $c = $d->accept) {
    while (my $r = $c->get_request) {
        my $path = $r->url->path;
        $path = '/index.html' if $path eq '/';
        $path =~ s/\.\.//g;  # basic traversal guard

        my $file = $root . $path;
        $file =~ s|/|\\|g if $^O eq 'MSWin32';

        if (-f $file) {
            my $type = 'text/plain';
            $type = 'text/html; charset=utf-8'  if $file =~ /\.html?$/i;
            $type = 'text/css'                   if $file =~ /\.css$/i;
            $type = 'application/javascript'     if $file =~ /\.js$/i;
            $type = 'image/png'                  if $file =~ /\.png$/i;
            $type = 'image/jpeg'                 if $file =~ /\.jpe?g$/i;
            $type = 'image/svg+xml'              if $file =~ /\.svg$/i;
            $type = 'application/json'           if $file =~ /\.json$/i;

            open my $fh, '<:raw', $file or do { $c->send_error(RC_INTERNAL_SERVER_ERROR); next; };
            local $/;
            my $body = <$fh>;
            close $fh;

            my $resp = HTTP::Response->new(RC_OK);
            $resp->header('Content-Type'   => $type);
            $resp->header('Content-Length' => length($body));
            $resp->header('Cache-Control'  => 'no-cache');
            $resp->content($body);
            $c->send_response($resp);
        } else {
            $c->send_error(RC_NOT_FOUND);
        }
    }
    $c->close;
}
