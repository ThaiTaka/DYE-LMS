# Sandbox image for problems whose test suites use real pytest features
# (fixtures, parametrize). Everything else runs on plain python:3.12-alpine via
# the stdlib driver in src/driver.ts, which needs no dependencies at all.
#
# Kept deliberately thin: every package installed here is code that will run in
# the same container as a student's program, so the smallest surface wins.
FROM python:3.12-alpine

# --no-cache-dir keeps the layer small; the pip cache would never be reused.
RUN pip install --no-cache-dir pytest==8.3.4 \
    && adduser -D -u 1000 hocsinh

# The container is started with --user 1000:1000 and a read-only rootfs, so this
# only documents intent; the runtime flags are the actual enforcement.
USER 1000:1000

# No ENTRYPOINT: the worker passes an explicit argv, so nothing here can be
# reinterpreted as a command.
