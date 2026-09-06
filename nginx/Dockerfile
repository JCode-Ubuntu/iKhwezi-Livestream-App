# nginx-rtmp for iKHWEZI.
#
# Wraps the stock tiangolo/nginx-rtmp image with an entrypoint that renders
# nginx.conf from nginx.conf.template at container start, injecting
# RTMP_WEBHOOK_SECRET into the on_publish/on_publish_done callback URLs.
# The stock image has no env-substitution step, which is why the secret was
# previously never sent and production had to rely on the
# TRUST_INTERNAL_RTMP_WEBHOOK bypass.
FROM tiangolo/nginx-rtmp:latest

COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]